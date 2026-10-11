/**
 * Quality Control Tower & Corrective Action Controller.
 * Provides deterministic quality intelligence, early-detection analytics,
 * rule-based alerts, and root-cause CAPA lifecycle tracking.
 */
const {
  STAGE_ORDER,
  SEVERITY_WEIGHTS,
  QUALITY_RULES,
  STAGE_CONFIG,
  STAGE_DEFECT_CATALOG,
  ALL_DEFECTS_MAP,
  getCatalogForStage,
} = require('../config/qualityStages.config');
const {
  computeQualityAnalytics,
  calculateActionRecurrence,
} = require('../utils/qualityGateEngine');
const { FabricRoll, Machine, CorrectiveAction, Counter } = require('../models');
const { CA_STATUSES, ROOT_CAUSE_CATEGORIES } = require('../models/CorrectiveAction');

/**
 * Helper to generate sequential CA Action Number: CA-<YYYY>-<4-digit sequence>
 */
const generateSequentialActionNumber = async (maxAttempts = 5) => {
  const currentYear = new Date().getFullYear();
  const counterKey = `ca_${currentYear}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seq = await Counter.getNextSequence(counterKey);
    const padded = String(seq).padStart(4, '0');
    const candidateNumber = `CA-${currentYear}-${padded}`;

    const exists = await CorrectiveAction.exists({ actionNumber: candidateNumber });
    if (!exists) {
      return candidateNumber;
    }
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CA-${currentYear}-${randomSuffix}`;
};

/**
 * GET /api/quality/config
 * Returns complete stage gate metadata, defect catalogs, severity weights, and demo thresholds.
 */
const getQualityConfig = async (req, res, next) => {
  try {
    return res.status(200).json({
      stageOrder: STAGE_ORDER,
      stages: STAGE_CONFIG,
      defectCatalog: STAGE_DEFECT_CATALOG,
      allDefects: ALL_DEFECTS_MAP,
      severityWeights: SEVERITY_WEIGHTS,
      rules: QUALITY_RULES,
      isDemoConfiguration: true,
      notice: 'Thresholds, defect catalogs, and scoring weights are demo placeholders configured for operations verification.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/quality/summary
 * Computes per-stage metrics, FPY, RTY, late-detection rate, escapes, Pareto, hotspots, and rolls on hold.
 * Query: days (default 30, 1-365), stage, machineCode.
 */
const getQualitySummary = async (req, res, next) => {
  try {
    const { days = 30, stage, machineCode } = req.query;

    const parsedDays = parseInt(days, 10);
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      return res.status(400).json({
        error: {
          message: "Query parameter 'days' must be an integer between 1 and 365",
          code: 'INVALID_DAYS_PARAMETER',
        },
      });
    }

    if (stage && !STAGE_ORDER.includes(stage.toUpperCase())) {
      return res.status(400).json({
        error: {
          message: `Invalid stage '${stage}'. Allowed stages: ${STAGE_ORDER.join(', ')}`,
          code: 'INVALID_STAGE_PARAMETER',
        },
      });
    }

    // Fetch all rolls, machines, and corrective actions from DB
    const [rolls, machines, correctiveActions] = await Promise.all([
      FabricRoll.find().populate('order').populate('machine'),
      Machine.find(),
      CorrectiveAction.find().populate('machine').populate('sourceRoll'),
    ]);

    const summary = computeQualityAnalytics({
      rolls,
      machines,
      correctiveActions,
      windowDays: parsedDays,
      stageFilter: stage ? stage.toUpperCase() : null,
      machineFilter: machineCode ? machineCode.toUpperCase() : null,
      now: new Date(),
    });

    return res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/quality/alerts
 * Returns rule-based alerts ordered by severity then recency.
 * Query: type (optional)
 */
const getQualityAlerts = async (req, res, next) => {
  try {
    const { type } = req.query;

    const [rolls, machines, correctiveActions] = await Promise.all([
      FabricRoll.find().populate('order').populate('machine'),
      Machine.find(),
      CorrectiveAction.find().populate('machine').populate('sourceRoll'),
    ]);

    const summary = computeQualityAnalytics({
      rolls,
      machines,
      correctiveActions,
      windowDays: QUALITY_RULES.ALERT_WINDOW_DAYS,
      now: new Date(),
    });

    let alerts = summary.alerts;
    if (type) {
      alerts = alerts.filter((a) => a.type === type.toUpperCase());
    }

    return res.status(200).json({
      alerts,
      count: alerts.length,
      asOf: summary.asOf,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Format Corrective Action for API response, embedding live recurrence analysis.
 */
const formatActionResponse = (actionDoc, allRolls = []) => {
  const action = actionDoc.toObject ? actionDoc.toObject() : actionDoc;
  const recurrence = calculateActionRecurrence(action, allRolls, new Date());

  const machineSummary = action.machine
    ? {
        _id: action.machine._id,
        code: action.machine.code,
        name: action.machine.name,
      }
    : null;

  const rollSummary = action.sourceRoll
    ? {
        _id: action.sourceRoll._id,
        rollId: action.sourceRoll.rollId,
      }
    : null;

  const defMeta = action.defectCode ? ALL_DEFECTS_MAP[action.defectCode] : null;

  return {
    _id: action._id,
    actionNumber: action.actionNumber,
    title: action.title,
    stage: action.stage,
    defectCode: action.defectCode,
    defectLabel: defMeta ? defMeta.label : action.defectCode,
    machine: machineSummary,
    machineCode: machineSummary ? machineSummary.code : null,
    sourceRoll: rollSummary,
    rollId: rollSummary ? rollSummary.rollId : null,
    rootCauseCategory: action.rootCauseCategory,
    description: action.description,
    owner: action.owner,
    dueDate: action.dueDate,
    status: action.status,
    verificationNote: action.verificationNote,
    doneAt: action.doneAt,
    verifiedAt: action.verifiedAt,
    isDemo: action.isDemo,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    recurrence,
  };
};

/**
 * GET /api/corrective-actions
 * Query: status, stage, machineCode, overdue, page, limit
 */
const getCorrectiveActions = async (req, res, next) => {
  try {
    const {
      status,
      stage,
      machineCode,
      overdue,
      page = 1,
      limit = 20,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = {};

    if (status) {
      filter.status = status.toUpperCase();
    }

    if (stage) {
      filter.stage = stage.toUpperCase();
    }

    if (machineCode) {
      const mach = await Machine.findOne({ code: machineCode.trim().toUpperCase() });
      if (mach) {
        filter.machine = mach._id;
      } else {
        return res.status(200).json({
          actions: [],
          pagination: { page: parsedPage, limit: parsedLimit, total: 0, totalPages: 1 },
        });
      }
    }

    if (overdue === 'true' || overdue === true) {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'VERIFIED' };
    }

    const total = await CorrectiveAction.countDocuments(filter);
    const totalPages = Math.ceil(total / parsedLimit) || 1;
    const skip = (parsedPage - 1) * parsedLimit;

    const [actions, allRolls] = await Promise.all([
      CorrectiveAction.find(filter)
        .populate('machine')
        .populate('sourceRoll')
        .sort('-createdAt')
        .skip(skip)
        .limit(parsedLimit),
      FabricRoll.find(),
    ]);

    const formatted = actions.map((a) => formatActionResponse(a, allRolls));

    return res.status(200).json({
      actions: formatted,
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
 * POST /api/corrective-actions
 */
const createCorrectiveAction = async (req, res, next) => {
  try {
    const allowedFields = [
      'title',
      'stage',
      'defectCode',
      'machineCode',
      'rollId',
      'rootCauseCategory',
      'rootCause',
      'description',
      'owner',
      'assignedTo',
      'dueDate',
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

    const title = req.body.title;
    const stage = req.body.stage;
    const defectCode = req.body.defectCode;
    const machineCode = req.body.machineCode;
    const rollId = req.body.rollId;
    const rootCauseCategory = req.body.rootCauseCategory || 'UNKNOWN';
    const description = req.body.description || req.body.rootCause;
    const owner = req.body.owner || req.body.assignedTo;
    const rawDueDate = req.body.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(422).json({
        error: { message: "Field 'title' is required", code: 'TITLE_REQUIRED' },
      });
    }

    if (!stage || !STAGE_ORDER.includes(stage.toUpperCase())) {
      return res.status(422).json({
        error: { message: `Field 'stage' must be one of: ${STAGE_ORDER.join(', ')}`, code: 'INVALID_STAGE' },
      });
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(422).json({
        error: { message: "Field 'description' is required", code: 'DESCRIPTION_REQUIRED' },
      });
    }

    if (!owner || typeof owner !== 'string' || owner.trim() === '') {
      return res.status(422).json({
        error: { message: "Field 'owner' is required", code: 'OWNER_REQUIRED' },
      });
    }

    const parsedDueDate = new Date(rawDueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return res.status(422).json({
        error: { message: "Field 'dueDate' must be a valid date", code: 'INVALID_DUE_DATE' },
      });
    }

    if (rootCauseCategory && !ROOT_CAUSE_CATEGORIES.includes(rootCauseCategory.toUpperCase())) {
      return res.status(422).json({
        error: {
          message: `Field 'rootCauseCategory' must be one of: ${ROOT_CAUSE_CATEGORIES.join(', ')}`,
          code: 'INVALID_ROOT_CAUSE_CATEGORY',
        },
      });
    }

    let targetMachine = null;
    if (machineCode) {
      targetMachine = await Machine.findOne({ code: machineCode.trim().toUpperCase() });
      if (!targetMachine) {
        return res.status(422).json({
          error: { message: `Machine '${machineCode}' not found`, code: 'MACHINE_NOT_FOUND' },
        });
      }
    }

    let targetRoll = null;
    if (rollId) {
      targetRoll = await FabricRoll.findOne({ rollId: rollId.trim().toUpperCase() });
      if (!targetRoll) {
        return res.status(422).json({
          error: { message: `Fabric roll '${rollId}' not found`, code: 'ROLL_NOT_FOUND' },
        });
      }
    }

    let normDefectCode = null;
    if (defectCode) {
      normDefectCode = defectCode.trim().toUpperCase();
      if (!ALL_DEFECTS_MAP[normDefectCode]) {
        return res.status(422).json({
          error: { message: `Defect code '${defectCode}' is not a recognized defect catalog code`, code: 'INVALID_DEFECT_CODE' },
        });
      }
    }

    const actionNumber = await generateSequentialActionNumber();

    const newAction = new CorrectiveAction({
      actionNumber,
      title: title.trim(),
      stage: stage.toUpperCase(),
      defectCode: normDefectCode,
      machine: targetMachine ? targetMachine._id : null,
      sourceRoll: targetRoll ? targetRoll._id : null,
      rootCauseCategory: rootCauseCategory.toUpperCase(),
      description: description.trim(),
      owner: owner.trim(),
      dueDate: parsedDueDate,
      status: 'OPEN',
      isDemo: false,
    });

    await newAction.save();
    await newAction.populate('machine');
    await newAction.populate('sourceRoll');

    const allRolls = await FabricRoll.find();

    return res.status(201).json({
      action: formatActionResponse(newAction, allRolls),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/corrective-actions/:actionNumber
 */
const getCorrectiveActionByNumber = async (req, res, next) => {
  try {
    const { actionNumber } = req.params;

    if (!actionNumber) {
      return res.status(400).json({
        error: { message: 'Action number is required', code: 'MISSING_ACTION_NUMBER' },
      });
    }

    const action = await CorrectiveAction.findOne({
      actionNumber: actionNumber.trim().toUpperCase(),
    })
      .populate('machine')
      .populate('sourceRoll');

    if (!action) {
      return res.status(404).json({
        error: { message: `Corrective action '${actionNumber}' not found`, code: 'ACTION_NOT_FOUND' },
      });
    }

    const allRolls = await FabricRoll.find();

    return res.status(200).json({
      action: formatActionResponse(action, allRolls),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/corrective-actions/:actionNumber
 * Status transitions & updates.
 * OPEN -> IN_PROGRESS -> DONE -> VERIFIED
 * DONE -> IN_PROGRESS (reopen)
 * VERIFIED is terminal.
 * VERIFIED requires non-empty verificationNote.
 */
const updateCorrectiveAction = async (req, res, next) => {
  try {
    const { actionNumber } = req.params;

    if (!actionNumber) {
      return res.status(400).json({
        error: { message: 'Action number is required', code: 'MISSING_ACTION_NUMBER' },
      });
    }

    const allowedFields = [
      'status',
      'title',
      'description',
      'owner',
      'dueDate',
      'rootCauseCategory',
      'verificationNote',
      'defectCode',
      'machineCode',
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

    const normActionNumber = actionNumber.trim().toUpperCase();
    const action = await CorrectiveAction.findOne({ actionNumber: normActionNumber })
      .populate('machine')
      .populate('sourceRoll');

    if (!action) {
      return res.status(404).json({
        error: { message: `Corrective action '${actionNumber}' not found`, code: 'ACTION_NOT_FOUND' },
      });
    }

    // Guard: VERIFIED is terminal
    if (action.status === 'VERIFIED') {
      return res.status(409).json({
        error: {
          message: `Corrective action '${normActionNumber}' is VERIFIED. VERIFIED is a terminal state and cannot be modified.`,
          code: 'ACTION_ALREADY_VERIFIED',
        },
      });
    }

    const updateSet = {};

    // Validate Status Transitions
    if (req.body.status) {
      const targetStatus = req.body.status.toUpperCase();
      if (!CA_STATUSES.includes(targetStatus)) {
        return res.status(422).json({
          error: {
            message: `Invalid status '${req.body.status}'. Valid statuses: ${CA_STATUSES.join(', ')}`,
            code: 'INVALID_STATUS',
          },
        });
      }

      const currentStatus = action.status;
      const isValidTransition =
        (currentStatus === 'OPEN' && (targetStatus === 'IN_PROGRESS' || targetStatus === 'OPEN')) ||
        (currentStatus === 'IN_PROGRESS' && (targetStatus === 'DONE' || targetStatus === 'IN_PROGRESS')) ||
        (currentStatus === 'DONE' && (targetStatus === 'VERIFIED' || targetStatus === 'IN_PROGRESS' || targetStatus === 'DONE'));

      if (!isValidTransition) {
        return res.status(409).json({
          error: {
            message: `Cannot transition corrective action from '${currentStatus}' to '${targetStatus}'. Allowed flow: OPEN → IN_PROGRESS → DONE → VERIFIED (or DONE → IN_PROGRESS).`,
            code: 'INVALID_TRANSITION',
          },
        });
      }

      if (targetStatus === 'VERIFIED') {
        const note = req.body.verificationNote !== undefined ? req.body.verificationNote : action.verificationNote;
        if (!note || typeof note !== 'string' || note.trim().length === 0) {
          return res.status(422).json({
            error: {
              message: "A non-empty 'verificationNote' is required to mark a corrective action as VERIFIED.",
              code: 'VERIFICATION_NOTE_REQUIRED',
            },
          });
        }
        updateSet.verificationNote = note.trim();
        updateSet.verifiedAt = new Date();
      }

      if (targetStatus === 'DONE') {
        updateSet.doneAt = new Date();
      }

      updateSet.status = targetStatus;
    }

    if (req.body.title !== undefined) updateSet.title = req.body.title.trim();
    if (req.body.description !== undefined) updateSet.description = req.body.description.trim();
    if (req.body.owner !== undefined) updateSet.owner = req.body.owner.trim();
    if (req.body.dueDate !== undefined) updateSet.dueDate = new Date(req.body.dueDate);
    if (req.body.verificationNote !== undefined && !updateSet.verificationNote) {
      updateSet.verificationNote = req.body.verificationNote ? req.body.verificationNote.trim() : null;
    }

    if (req.body.rootCauseCategory !== undefined) {
      const cat = req.body.rootCauseCategory.toUpperCase();
      if (!ROOT_CAUSE_CATEGORIES.includes(cat)) {
        return res.status(422).json({
          error: {
            message: `Invalid rootCauseCategory '${req.body.rootCauseCategory}'. Allowed: ${ROOT_CAUSE_CATEGORIES.join(', ')}`,
            code: 'INVALID_ROOT_CAUSE_CATEGORY',
          },
        });
      }
      updateSet.rootCauseCategory = cat;
    }

    if (req.body.defectCode !== undefined) {
      const code = req.body.defectCode ? req.body.defectCode.trim().toUpperCase() : null;
      if (code && !ALL_DEFECTS_MAP[code]) {
        return res.status(422).json({
          error: { message: `Defect code '${code}' not recognized`, code: 'INVALID_DEFECT_CODE' },
        });
      }
      updateSet.defectCode = code;
    }

    if (req.body.machineCode !== undefined) {
      if (req.body.machineCode) {
        const mach = await Machine.findOne({ code: req.body.machineCode.trim().toUpperCase() });
        if (!mach) {
          return res.status(422).json({
            error: { message: `Machine '${req.body.machineCode}' not found`, code: 'MACHINE_NOT_FOUND' },
          });
        }
        updateSet.machine = mach._id;
      } else {
        updateSet.machine = null;
      }
    }

    // Atomic conditional update
    const updatedAction = await CorrectiveAction.findOneAndUpdate(
      {
        actionNumber: normActionNumber,
        status: { $ne: 'VERIFIED' }, // Concurrency guard: verify cannot be overwritten
      },
      {
        $set: updateSet,
      },
      { new: true }
    )
      .populate('machine')
      .populate('sourceRoll');

    if (!updatedAction) {
      return res.status(409).json({
        error: {
          message: 'Corrective action update failed due to concurrent modification or terminal state',
          code: 'CONCURRENT_MODIFICATION',
        },
      });
    }

    const allRolls = await FabricRoll.find();

    return res.status(200).json({
      action: formatActionResponse(updatedAction, allRolls),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQualityConfig,
  getQualitySummary,
  getQualityAlerts,
  getCorrectiveActions,
  createCorrectiveAction,
  getCorrectiveActionByNumber,
  updateCorrectiveAction,
};
