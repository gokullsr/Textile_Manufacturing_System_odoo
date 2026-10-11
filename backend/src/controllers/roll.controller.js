/**
 * Fabric Roll Controller.
 * Manages digital QR identity generation, stage quality gate inspections, and dispatch workflows.
 */
const { FabricRoll, ProductionOrder, Machine, Counter } = require('../models');
const {
  validateRollId,
  validateQuantityMetres,
  validateInspectionInput,
  validateDispatchTransition,
  calculateAllowedActions,
  checkAdvanceEligibility,
} = require('../utils/rollRules');
const { evaluateInspection, validateOverride } = require('../utils/qualityGateEngine');
const { PAGINATION, ALLOWED_ROLL_SORT_FIELDS } = require('../config/thresholds');
const { escapeRegex } = require('../utils/derivedMetrics');

const generateSequentialRollId = async (maxAttempts = 5) => {
  const currentYear = new Date().getFullYear();
  const counterKey = `roll_${currentYear}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seq = await Counter.getNextSequence(counterKey);
    const padded = String(seq).padStart(6, '0');
    const candidateId = `FR-${currentYear}-${padded}`;

    const exists = await FabricRoll.exists({ rollId: candidateId });
    if (!exists) {
      return candidateId;
    }
  }

  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `FR-${currentYear}-${randomSuffix}`;
};

const formatRollPassport = (rollDoc) => {
  const roll = rollDoc.toObject ? rollDoc.toObject() : rollDoc;

  const orderSummary = roll.order
    ? {
        _id: roll.order._id,
        orderNumber: roll.order.orderNumber,
        buyer: roll.order.customer,
        customer: roll.order.customer,
        fabricType: roll.order.fabricType,
        dueDate: roll.order.dueDate,
        status: roll.order.status,
      }
    : null;

  const machineSummary = roll.machine
    ? {
        _id: roll.machine._id,
        machineCode: roll.machine.code,
        code: roll.machine.code,
        name: roll.machine.name,
        type: roll.machine.type,
      }
    : null;

  const allowedActions = calculateAllowedActions(roll);

  return {
    _id: roll._id,
    rollId: roll.rollId,
    quantityMetres: roll.quantityMetres,
    qualityStatus: roll.qualityStatus,
    defectNotes: roll.defectNotes,
    inspectedAt: roll.inspectedAt,
    dispatchStatus: roll.dispatchStatus,
    dispatchedAt: roll.dispatchedAt,
    weight: roll.weight,
    stage: roll.stage || 'GREY',
    stageEnteredAt: roll.stageEnteredAt || roll.createdAt,
    stageHistory: roll.stageHistory || [],
    producedAt: roll.producedAt,
    createdAt: roll.createdAt,
    updatedAt: roll.updatedAt,
    order: orderSummary,
    machine: machineSummary,
    inspections: (roll.inspections || []).slice().reverse(),
    allowedActions,
  };
};

/**
 * GET /api/rolls
 */
const getRolls = async (req, res, next) => {
  try {
    const {
      qualityStatus,
      dispatchStatus,
      stage,
      awaitingInspection,
      orderNumber,
      machineCode,
      search,
      page = 1,
      limit = PAGINATION.DEFAULT_LIMIT,
      sort = '-createdAt',
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      PAGINATION.MAX_LIMIT,
      Math.max(1, parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT)
    );

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    if (sortField && !ALLOWED_ROLL_SORT_FIELDS.includes(sortField)) {
      return res.status(400).json({
        error: {
          message: `Invalid sort field '${sortField}'. Allowed fields: ${ALLOWED_ROLL_SORT_FIELDS.join(', ')}`,
          code: 'INVALID_SORT_FIELD',
        },
      });
    }

    const queryFilter = {};

    if (qualityStatus) {
      queryFilter.qualityStatus = qualityStatus.toUpperCase();
    }

    if (dispatchStatus) {
      queryFilter.dispatchStatus = dispatchStatus.toUpperCase();
    }

    if (stage) {
      queryFilter.stage = stage.toUpperCase();
    }

    if (awaitingInspection === 'true' || awaitingInspection === true) {
      queryFilter.qualityStatus = 'PENDING';
      queryFilter.dispatchStatus = { $ne: 'DISPATCHED' };
    }

    if (search && search.trim() !== '') {
      const sanitized = escapeRegex(search.trim().toUpperCase());
      queryFilter.rollId = { $regex: sanitized, $options: 'i' };
    }

    if (orderNumber) {
      const targetOrder = await ProductionOrder.findOne({
        orderNumber: orderNumber.trim().toUpperCase(),
      });

      if (targetOrder) {
        queryFilter.order = targetOrder._id;
      } else {
        return res.status(200).json({
          rolls: [],
          pagination: { page: parsedPage, limit: parsedLimit, total: 0, totalPages: 1 },
        });
      }
    }

    if (machineCode) {
      const targetMachine = await Machine.findOne({
        code: machineCode.trim().toUpperCase(),
      });

      if (targetMachine) {
        queryFilter.machine = targetMachine._id;
      } else {
        return res.status(200).json({
          rolls: [],
          pagination: { page: parsedPage, limit: parsedLimit, total: 0, totalPages: 1 },
        });
      }
    }

    const total = await FabricRoll.countDocuments(queryFilter);
    const totalPages = Math.ceil(total / parsedLimit) || 1;
    const skip = (parsedPage - 1) * parsedLimit;

    const rolls = await FabricRoll.find(queryFilter)
      .populate('order')
      .populate('machine')
      .sort(sort)
      .skip(skip)
      .limit(parsedLimit);

    const formattedRolls = rolls.map(formatRollPassport);

    return res.status(200).json({
      rolls: formattedRolls,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rolls
 */
const createRoll = async (req, res, next) => {
  try {
    const allowedFields = [
      'orderNumber',
      'machineCode',
      'quantityMetres',
      'rollId',
      'weight',
      'stage',
      'producedAt',
    ];

    const bodyKeys = Object.keys(req.body);
    const unknownKeys = bodyKeys.filter((k) => !allowedFields.includes(k));

    if (unknownKeys.length > 0) {
      return res.status(422).json({
        error: {
          message: `Unknown field(s) in payload: ${unknownKeys.join(', ')}`,
          code: 'DISALLOWED_FIELD',
        },
      });
    }

    const { orderNumber, machineCode, quantityMetres, rollId, weight, stage, producedAt } = req.body;

    if (!orderNumber || typeof orderNumber !== 'string' || orderNumber.trim() === '') {
      return res.status(422).json({
        error: {
          message: "Field 'orderNumber' is required",
          code: 'ORDER_NUMBER_REQUIRED',
        },
      });
    }

    const targetOrder = await ProductionOrder.findOne({
      orderNumber: orderNumber.trim().toUpperCase(),
    });

    if (!targetOrder) {
      return res.status(422).json({
        error: {
          message: `Production order '${orderNumber}' does not exist`,
          code: 'ORDER_NOT_FOUND',
        },
      });
    }

    if (!machineCode || typeof machineCode !== 'string' || machineCode.trim() === '') {
      return res.status(422).json({
        error: {
          message: "Field 'machineCode' is required to establish roll machine traceability",
          code: 'MACHINE_CODE_REQUIRED',
        },
      });
    }

    const targetMachine = await Machine.findOne({
      code: machineCode.trim().toUpperCase(),
    });

    if (!targetMachine) {
      return res.status(422).json({
        error: {
          message: `Machine with code '${machineCode}' does not exist`,
          code: 'MACHINE_NOT_FOUND',
        },
      });
    }

    const qtyCheck = validateQuantityMetres(quantityMetres);
    if (!qtyCheck.valid) {
      return res.status(422).json({
        error: {
          message: qtyCheck.error,
          code: 'INVALID_QUANTITY',
        },
      });
    }

    let finalRollId;
    if (rollId) {
      const idCheck = validateRollId(rollId);
      if (!idCheck.valid) {
        return res.status(400).json({
          error: {
            message: idCheck.error,
            code: 'INVALID_ROLL_ID_FORMAT',
          },
        });
      }

      finalRollId = idCheck.normalized;

      const exists = await FabricRoll.exists({ rollId: finalRollId });
      if (exists) {
        return res.status(409).json({
          error: {
            message: `A fabric roll with ID '${finalRollId}' already exists`,
            code: 'DUPLICATE_ROLL_ID',
          },
        });
      }
    } else {
      finalRollId = await generateSequentialRollId();
    }

    const initialStage = typeof stage === 'string' && stage.trim() ? stage.trim().toUpperCase() : 'GREY';
    const creationTime = producedAt ? new Date(producedAt) : new Date();

    const newRoll = new FabricRoll({
      rollId: finalRollId,
      order: targetOrder._id,
      machine: targetMachine._id,
      quantityMetres: qtyCheck.value,
      weight: typeof weight === 'number' && weight >= 0 ? weight : 0,
      stage: initialStage,
      stageEnteredAt: creationTime,
      stageHistory: [
        {
          stage: initialStage,
          machineCode: targetMachine.code,
          enteredAt: creationTime,
          exitedAt: null,
        },
      ],
      producedAt: creationTime,
      qualityStatus: 'PENDING',
      dispatchStatus: 'NOT_DISPATCHED',
      defectNotes: '',
      inspections: [],
    });

    try {
      await newRoll.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          error: {
            message: `Fabric roll with ID '${finalRollId}' already exists`,
            code: 'DUPLICATE_ROLL_ID',
          },
        });
      }
      throw err;
    }

    await newRoll.populate('order');
    await newRoll.populate('machine');

    return res.status(201).json({
      roll: formatRollPassport(newRoll),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rolls/:rollId
 */
const getRollByRollId = async (req, res, next) => {
  try {
    const { rollId } = req.params;

    if (!rollId) {
      return res.status(400).json({
        error: {
          message: 'Roll ID parameter is missing',
          code: 'MISSING_ROLL_ID',
        },
      });
    }

    const idCheck = validateRollId(rollId);
    if (!idCheck.valid) {
      return res.status(400).json({
        error: {
          message: idCheck.error,
          code: 'INVALID_ROLL_ID_FORMAT',
        },
      });
    }

    const roll = await FabricRoll.findOne({ rollId: idCheck.normalized })
      .populate('order')
      .populate('machine');

    if (!roll) {
      return res.status(404).json({
        error: {
          message: `Fabric roll '${idCheck.normalized}' not found in registry`,
          code: 'ROLL_NOT_FOUND',
        },
      });
    }

    return res.status(200).json({
      roll: formatRollPassport(roll),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rolls/:rollId/inspection/preview
 * Calculates points, recommended verdict, explanation trace, and override requirement.
 * WRITES NOTHING to database.
 */
const previewInspection = async (req, res, next) => {
  try {
    const { rollId } = req.params;

    const idCheck = validateRollId(rollId);
    if (!idCheck.valid) {
      return res.status(400).json({
        error: {
          message: idCheck.error,
          code: 'INVALID_ROLL_ID_FORMAT',
        },
      });
    }

    const roll = await FabricRoll.findOne({ rollId: idCheck.normalized });
    if (!roll) {
      return res.status(404).json({
        error: {
          message: `Fabric roll '${idCheck.normalized}' not found`,
          code: 'ROLL_NOT_FOUND',
        },
      });
    }

    const allowedFields = ['defects', 'result', 'defectNotes', 'overrideReason', 'inspectorName'];
    const bodyKeys = Object.keys(req.body);
    const unknownKeys = bodyKeys.filter((k) => !allowedFields.includes(k));

    if (unknownKeys.length > 0) {
      return res.status(422).json({
        error: {
          message: `Unknown field(s) in preview payload: ${unknownKeys.join(', ')}`,
          code: 'DISALLOWED_FIELD',
        },
      });
    }

    const { defects = [], result } = req.body;
    const currentStage = roll.stage || 'GREY';

    const reworksAtStage = (roll.inspections || []).filter(
      (insp) => (insp.stage || 'GREY') === currentStage && insp.result === 'REWORK'
    ).length;

    const evalResult = evaluateInspection({
      stage: currentStage,
      quantityMetres: roll.quantityMetres,
      defects,
      reworkCountAtStage: reworksAtStage,
    });

    let requiresOverrideReason = false;
    if (result) {
      const overrideCheck = validateOverride(evalResult.recommendedResult, result, req.body.overrideReason);
      if (!overrideCheck.valid && overrideCheck.code === 'OVERRIDE_REASON_REQUIRED') {
        requiresOverrideReason = true;
      }
    }

    return res.status(200).json({
      preview: {
        stage: currentStage,
        defectPoints: evalResult.defectPoints,
        pointsPer100m: evalResult.pointsPer100m,
        recommendedResult: evalResult.recommendedResult,
        calculation: evalResult.calculation,
        calculationTrace: evalResult.calculation,
        explanation: evalResult.explanation,
        hasCritical: evalResult.hasCritical,
        passMax: evalResult.passMax,
        reworkMax: evalResult.reworkMax,
        requiresOverrideReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/rolls/:rollId/inspection
 * Submit a quality gate inspection. Stage is taken strictly from the roll.
 */
const submitInspection = async (req, res, next) => {
  try {
    const { rollId } = req.params;

    const idCheck = validateRollId(rollId);
    if (!idCheck.valid) {
      return res.status(400).json({
        error: {
          message: idCheck.error,
          code: 'INVALID_ROLL_ID_FORMAT',
        },
      });
    }

    if (req.body.inspectedAt !== undefined) {
      return res.status(422).json({
        error: {
          message: "Field 'inspectedAt' cannot be supplied by the client; it is set automatically by the server",
          code: 'DISALLOWED_FIELD',
        },
      });
    }

    const allowedFields = ['result', 'qualityStatus', 'defectNotes', 'inspectorName', 'inspectedBy', 'defects', 'isOverride', 'overrideReason', 'stage'];
    const bodyKeys = Object.keys(req.body);
    const unknownKeys = bodyKeys.filter((k) => !allowedFields.includes(k));

    if (unknownKeys.length > 0) {
      return res.status(422).json({
        error: {
          message: `Unknown field(s) in inspection payload: ${unknownKeys.join(', ')}`,
          code: 'DISALLOWED_FIELD',
        },
      });
    }

    const roll = await FabricRoll.findOne({ rollId: idCheck.normalized }).populate('machine');
    if (!roll) {
      return res.status(404).json({
        error: {
          message: `Fabric roll '${idCheck.normalized}' not found`,
          code: 'ROLL_NOT_FOUND',
        },
      });
    }

    if (roll.dispatchStatus === 'DISPATCHED') {
      return res.status(409).json({
        error: {
          message: "Roll has already been dispatched. 'DISPATCHED' rolls cannot undergo quality re-inspection.",
          code: 'ROLL_ALREADY_DISPATCHED',
        },
      });
    }

    const currentStage = roll.stage || 'GREY';

    // If client tried to explicitly specify a stage different from roll.stage, reject with 409
    if (req.body.stage && req.body.stage.toUpperCase() !== currentStage) {
      return res.status(409).json({
        error: {
          message: `Cannot inspect stage '${req.body.stage}'. Roll is currently at stage '${currentStage}'.`,
          code: 'STAGE_MISMATCH',
        },
      });
    }

    // Determine machine code snapshotted from active stage history
    const activeStageHistory = (roll.stageHistory || []).find((h) => h.stage === currentStage && !h.exitedAt);
    const snapshottedMachineCode = activeStageHistory?.machineCode || (roll.machine ? roll.machine.code : null);

    const reworksAtStage = (roll.inspections || []).filter(
      (insp) => (insp.stage || 'GREY') === currentStage && insp.result === 'REWORK'
    ).length;

    const submittedResult = req.body.result || req.body.qualityStatus;
    const submittedInspector = req.body.inspectorName || req.body.inspectedBy;

    // Validate inspection payload
    const check = validateInspectionInput({
      result: submittedResult,
      defectNotes: req.body.defectNotes,
      inspectorName: submittedInspector,
      defects: req.body.defects || [],
      overrideReason: req.body.overrideReason,
      stage: currentStage,
      quantityMetres: roll.quantityMetres,
      reworkCountAtStage: reworksAtStage,
    });

    if (!check.valid) {
      return res.status(422).json({
        error: {
          message: check.error,
          code: check.code || 'VALIDATION_ERROR',
        },
      });
    }

    const now = new Date();

    const sessionInspectorName = req.user ? req.user.name : (submittedInspector || 'QA Inspector');
    const newInspection = {
      stage: currentStage,
      result: check.result,
      defects: check.defects || [],
      defectPoints: check.defectPoints || 0,
      pointsPer100m: check.pointsPer100m || 0,
      recommendedResult: check.recommendedResult,
      isOverride: check.isOverride || false,
      overrideReason: check.overrideReason || null,
      machineCode: snapshottedMachineCode,
      defectNotes: check.defectNotes,
      inspectorName: sessionInspectorName,
      inspectedBy: req.user ? { userId: req.user._id, name: req.user.name } : null,
      inspectedAt: now,
    };

    let nextDispatchStatus = roll.dispatchStatus;
    if (roll.dispatchStatus === 'READY_FOR_DISPATCH' && check.result !== 'PASS') {
      nextDispatchStatus = 'NOT_DISPATCHED';
    }

    const updatedRoll = await FabricRoll.findOneAndUpdate(
      {
        rollId: idCheck.normalized,
        stage: currentStage,
        dispatchStatus: { $ne: 'DISPATCHED' },
      },
      {
        $set: {
          qualityStatus: check.result,
          defectNotes: check.defectNotes,
          inspectedAt: now,
          dispatchStatus: nextDispatchStatus,
        },
        $push: {
          inspections: newInspection,
        },
      },
      { new: true }
    )
      .populate('order')
      .populate('machine');

    if (!updatedRoll) {
      return res.status(409).json({
        error: {
          message: 'Roll inspection update failed due to concurrent modification or stage transition',
          code: 'CONCURRENT_MODIFICATION',
        },
      });
    }

    return res.status(200).json({
      roll: formatRollPassport(updatedRoll),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rolls/:rollId/advance
 * Advances roll to next quality stage.
 * Atomic conditional update: closes old stage history, opens new one, resets qualityStatus to PENDING.
 */
const advanceStage = async (req, res, next) => {
  try {
    const { rollId } = req.params;

    const idCheck = validateRollId(rollId);
    if (!idCheck.valid) {
      return res.status(400).json({
        error: {
          message: idCheck.error,
          code: 'INVALID_ROLL_ID_FORMAT',
        },
      });
    }

    const allowedFields = ['machineCode'];
    const bodyKeys = Object.keys(req.body);
    const unknownKeys = bodyKeys.filter((k) => !allowedFields.includes(k));

    if (unknownKeys.length > 0) {
      return res.status(422).json({
        error: {
          message: `Unknown field(s) in advance payload: ${unknownKeys.join(', ')}`,
          code: 'DISALLOWED_FIELD',
        },
      });
    }

    const roll = await FabricRoll.findOne({ rollId: idCheck.normalized }).populate('machine');
    if (!roll) {
      return res.status(404).json({
        error: {
          message: `Fabric roll '${idCheck.normalized}' not found`,
          code: 'ROLL_NOT_FOUND',
        },
      });
    }

    let targetMachine = null;
    if (req.body.machineCode) {
      targetMachine = await Machine.findOne({
        code: req.body.machineCode.trim().toUpperCase(),
      });
      if (!targetMachine) {
        return res.status(422).json({
          error: {
            message: `Machine with code '${req.body.machineCode}' does not exist`,
            code: 'MACHINE_NOT_FOUND',
          },
        });
      }
    }

    // Check advance eligibility
    const eligibility = checkAdvanceEligibility(roll, targetMachine);
    if (!eligibility.canAdvance) {
      return res.status(eligibility.status || 409).json({
        error: {
          message: eligibility.reason,
          code: eligibility.code || 'GATE_NOT_PASSED',
        },
      });
    }

    const now = new Date();
    const currentStage = roll.stage || 'GREY';
    const nextStage = eligibility.nextStage;

    // Prepare updated stageHistory
    const updatedHistory = (roll.stageHistory || []).map((h) => {
      if (h.stage === currentStage && !h.exitedAt) {
        return {
          stage: h.stage,
          machineCode: h.machineCode,
          enteredAt: h.enteredAt,
          exitedAt: now,
        };
      }
      return h;
    });

    updatedHistory.push({
      stage: nextStage,
      machineCode: targetMachine ? targetMachine.code : null,
      enteredAt: now,
      exitedAt: null,
    });

    // Atomic conditional update
    const updatedRoll = await FabricRoll.findOneAndUpdate(
      {
        rollId: idCheck.normalized,
        stage: currentStage, // Concurrency guard: must be at expected stage
        qualityStatus: 'PASS', // Concurrency guard: must have passed current stage
        dispatchStatus: { $ne: 'DISPATCHED' },
      },
      {
        $set: {
          stage: nextStage,
          stageEnteredAt: now,
          qualityStatus: 'PENDING',
          defectNotes: '',
          stageHistory: updatedHistory,
          machine: targetMachine ? targetMachine._id : roll.machine,
        },
      },
      { new: true }
    )
      .populate('order')
      .populate('machine');

    if (!updatedRoll) {
      return res.status(409).json({
        error: {
          message: 'Roll stage advancement failed due to concurrent modification or gate status change',
          code: 'CONCURRENT_MODIFICATION',
        },
      });
    }

    return res.status(200).json({
      roll: formatRollPassport(updatedRoll),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/rolls/:rollId/dispatch
 */
const updateDispatchStatus = async (req, res, next) => {
  try {
    const { rollId } = req.params;

    const idCheck = validateRollId(rollId);
    if (!idCheck.valid) {
      return res.status(400).json({
        error: {
          message: idCheck.error,
          code: 'INVALID_ROLL_ID_FORMAT',
        },
      });
    }

    const allowedFields = ['dispatchStatus'];
    const bodyKeys = Object.keys(req.body);
    const unknownKeys = bodyKeys.filter((k) => !allowedFields.includes(k));

    if (unknownKeys.length > 0) {
      return res.status(422).json({
        error: {
          message: `Unknown field(s) in dispatch payload: ${unknownKeys.join(', ')}`,
          code: 'DISALLOWED_FIELD',
        },
      });
    }

    const { dispatchStatus } = req.body;
    if (!dispatchStatus) {
      return res.status(422).json({
        error: {
          message: "Field 'dispatchStatus' is required",
          code: 'DISPATCH_STATUS_REQUIRED',
        },
      });
    }

    const roll = await FabricRoll.findOne({ rollId: idCheck.normalized });
    if (!roll) {
      return res.status(404).json({
        error: {
          message: `Fabric roll '${idCheck.normalized}' not found`,
          code: 'ROLL_NOT_FOUND',
        },
      });
    }

    const transitionCheck = validateDispatchTransition(
      roll.dispatchStatus,
      roll.qualityStatus,
      dispatchStatus,
      roll.stage
    );

    if (!transitionCheck.valid) {
      return res.status(transitionCheck.status || 409).json({
        error: {
          message: transitionCheck.error,
          code: transitionCheck.code || 'INVALID_TRANSITION',
        },
      });
    }

    const now = new Date();
    const updateSet = {
      dispatchStatus,
      dispatchedAt: dispatchStatus === 'DISPATCHED' ? now : null,
      dispatchedBy: dispatchStatus === 'DISPATCHED' && req.user ? { userId: req.user._id, name: req.user.name } : null,
    };

    const updatedRoll = await FabricRoll.findOneAndUpdate(
      {
        rollId: idCheck.normalized,
        dispatchStatus: { $ne: 'DISPATCHED' },
      },
      {
        $set: updateSet,
      },
      { new: true }
    )
      .populate('order')
      .populate('machine');

    if (!updatedRoll) {
      return res.status(409).json({
        error: {
          message: 'Roll dispatch update failed due to concurrent modification',
          code: 'CONCURRENT_MODIFICATION',
        },
      });
    }

    return res.status(200).json({
      roll: formatRollPassport(updatedRoll),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRolls,
  createRoll,
  getRollByRollId,
  previewInspection,
  submitInspection,
  advanceStage,
  updateDispatchStatus,
};
