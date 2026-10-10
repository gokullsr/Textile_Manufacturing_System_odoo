/**
 * Fabric Roll Controller.
 * Manages digital QR identity generation, quality inspections, and dispatch workflows.
 */
const { FabricRoll, ProductionOrder, Machine, Counter } = require('../models');
const {
  validateRollId,
  validateQuantityMetres,
  validateInspectionInput,
  validateDispatchTransition,
  calculateAllowedActions,
} = require('../utils/rollRules');
const { PAGINATION, ALLOWED_ROLL_SORT_FIELDS } = require('../config/thresholds');
const { escapeRegex } = require('../utils/derivedMetrics');

/**
 * Helper to generate sequential Roll ID: FR-<YYYY>-<6-digit sequence>
 */
const generateSequentialRollId = async (maxAttempts = 5) => {
  const currentYear = new Date().getFullYear();
  const counterKey = `roll_${currentYear}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seq = await Counter.getNextSequence(counterKey);
    const padded = String(seq).padStart(6, '0');
    const candidateId = `FR-${currentYear}-${padded}`;

    // Verify candidate does not already exist
    const exists = await FabricRoll.exists({ rollId: candidateId });
    if (!exists) {
      return candidateId;
    }
  }

  // Fallback timestamp randomizer if all sequential attempts collide
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `FR-${currentYear}-${randomSuffix}`;
};

/**
 * Format single roll document into standardized Passport API response
 */
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
    stage: roll.stage,
    producedAt: roll.producedAt,
    createdAt: roll.createdAt,
    updatedAt: roll.updatedAt,
    order: orderSummary,
    machine: machineSummary,
    inspections: (roll.inspections || []).slice().reverse(), // Newest first
    allowedActions,
  };
};

/**
 * GET /api/rolls
 * Query: qualityStatus, dispatchStatus, orderNumber, machineCode, search, page, limit, sort
 */
const getRolls = async (req, res, next) => {
  try {
    const {
      qualityStatus,
      dispatchStatus,
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

    // Validate sort
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

    if (search && search.trim() !== '') {
      const sanitized = escapeRegex(search.trim().toUpperCase());
      queryFilter.rollId = { $regex: sanitized, $options: 'i' };
    }

    // Filter by orderNumber reference
    if (orderNumber) {
      const targetOrder = await ProductionOrder.findOne({
        orderNumber: orderNumber.trim().toUpperCase(),
      });
      if (targetOrder) {
        queryFilter.order = targetOrder._id;
      } else {
        // Return empty result immediately if non-existent order queried
        return res.status(200).json({
          rolls: [],
          pagination: { page: parsedPage, limit: parsedLimit, total: 0, totalPages: 1 },
        });
      }
    }

    // Filter by machineCode reference
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
 * Create new fabric roll digital passport
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

    // 1. Validate Order reference
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

    // 2. Validate Machine reference
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

    // 3. Validate Quantity
    const qtyCheck = validateQuantityMetres(quantityMetres);
    if (!qtyCheck.valid) {
      return res.status(422).json({
        error: {
          message: qtyCheck.error,
          code: 'INVALID_QUANTITY',
        },
      });
    }

    // 4. Determine Roll ID
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

      // Check unique index conflict upfront for custom ID
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

    // 5. Create Roll Record
    const newRoll = new FabricRoll({
      rollId: finalRollId,
      order: targetOrder._id,
      machine: targetMachine._id,
      quantityMetres: qtyCheck.value,
      weight: typeof weight === 'number' && weight >= 0 ? weight : 0,
      stage: typeof stage === 'string' && stage.trim() ? stage.trim() : 'finished',
      producedAt: producedAt ? new Date(producedAt) : new Date(),
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
 * Retrieve full Fabric Passport with inspection history and allowed actions
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
 * PATCH /api/rolls/:rollId/inspection
 * Submit a quality inspection result (PASS / REWORK / REJECT)
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

    // Reject client-supplied inspectedAt
    if (req.body.inspectedAt !== undefined) {
      return res.status(422).json({
        error: {
          message: "Field 'inspectedAt' cannot be supplied by the client; it is set automatically by the server",
          code: 'DISALLOWED_FIELD',
        },
      });
    }

    const allowedFields = ['result', 'defectNotes', 'inspectorName'];
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

    // Validate inspection parameters
    const check = validateInspectionInput(req.body);
    if (!check.valid) {
      return res.status(422).json({
        error: {
          message: check.error,
          code: check.code || 'VALIDATION_ERROR',
        },
      });
    }

    // 1. Fetch current roll
    const roll = await FabricRoll.findOne({ rollId: idCheck.normalized });
    if (!roll) {
      return res.status(404).json({
        error: {
          message: `Fabric roll '${idCheck.normalized}' not found`,
          code: 'ROLL_NOT_FOUND',
        },
      });
    }

    // 2. Guard: DISPATCHED roll cannot be inspected
    if (roll.dispatchStatus === 'DISPATCHED') {
      return res.status(409).json({
        error: {
          message: "Roll has already been dispatched. 'DISPATCHED' rolls cannot undergo quality re-inspection.",
          code: 'ROLL_ALREADY_DISPATCHED',
        },
      });
    }

    const now = new Date();

    // 3. New inspection history item
    const newInspection = {
      result: check.result,
      defectNotes: check.defectNotes,
      inspectorName: check.inspectorName,
      inspectedAt: now,
    };

    // 4. Atomic conditional update:
    // If current dispatchStatus is READY_FOR_DISPATCH and inspection result is REWORK/REJECT, reset to NOT_DISPATCHED
    let nextDispatchStatus = roll.dispatchStatus;
    if (roll.dispatchStatus === 'READY_FOR_DISPATCH' && check.result !== 'PASS') {
      nextDispatchStatus = 'NOT_DISPATCHED';
    }

    const updatedRoll = await FabricRoll.findOneAndUpdate(
      {
        rollId: idCheck.normalized,
        dispatchStatus: { $ne: 'DISPATCHED' }, // Atomic concurrency guard
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
          message: 'Roll inspection update failed due to concurrent modification or dispatch transition',
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
 * Transition dispatch lifecycle (READY_FOR_DISPATCH / DISPATCHED / NOT_DISPATCHED)
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

    // Validate dispatch transition rules
    const transitionCheck = validateDispatchTransition(
      roll.dispatchStatus,
      roll.qualityStatus,
      dispatchStatus
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
    };

    // Atomic update
    const updatedRoll = await FabricRoll.findOneAndUpdate(
      {
        rollId: idCheck.normalized,
        dispatchStatus: { $ne: 'DISPATCHED' }, // Concurrency guard
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
  submitInspection,
  updateDispatchStatus,
};
