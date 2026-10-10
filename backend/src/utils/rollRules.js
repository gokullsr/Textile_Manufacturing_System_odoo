/**
 * Pure business rules engine for Fabric Rolls.
 * Zero database or React dependencies — completely unit testable.
 */
const { ROLL_LIMITS, ROLL_ID_REGEX } = require('../config/thresholds');

const VALID_INSPECTION_RESULTS = ['PASS', 'REWORK', 'REJECT'];
const VALID_DISPATCH_STATUSES = ['NOT_DISPATCHED', 'READY_FOR_DISPATCH', 'DISPATCHED'];

/**
 * Validates custom or generated Roll ID.
 */
const validateRollId = (rollId) => {
  if (typeof rollId !== 'string') {
    return { valid: false, error: 'Roll ID must be a string' };
  }
  const normalized = rollId.trim().toUpperCase();
  if (!ROLL_ID_REGEX.test(normalized)) {
    return {
      valid: false,
      error: `Invalid Roll ID '${rollId}'. Must match format ^[A-Z0-9][A-Z0-9-]{2,39}$ (e.g. 'FR-2026-000001')`,
    };
  }
  return { valid: true, normalized };
};

/**
 * Validates roll quantity in metres.
 */
const validateQuantityMetres = (quantity) => {
  if (quantity === undefined || quantity === null || quantity === '') {
    return { valid: false, error: 'Field `quantityMetres` is required' };
  }
  const num = Number(quantity);
  if (isNaN(num)) {
    return { valid: false, error: 'Field `quantityMetres` must be a valid number' };
  }
  if (num < ROLL_LIMITS.MIN_QUANTITY_METRES) {
    return {
      valid: false,
      error: `Field \`quantityMetres\` must be at least ${ROLL_LIMITS.MIN_QUANTITY_METRES} m`,
    };
  }
  if (num > ROLL_LIMITS.MAX_QUANTITY_METRES) {
    return {
      valid: false,
      error: `Field \`quantityMetres\` cannot exceed ${ROLL_LIMITS.MAX_QUANTITY_METRES} m`,
    };
  }

  // Check decimal precision (at most 2 decimals)
  const decimalStr = num.toString().split('.')[1];
  if (decimalStr && decimalStr.length > ROLL_LIMITS.MAX_DECIMAL_PLACES) {
    return {
      valid: false,
      error: `Field \`quantityMetres\` can have at most ${ROLL_LIMITS.MAX_DECIMAL_PLACES} decimal places`,
    };
  }

  return { valid: true, value: Math.round(num * 100) / 100 };
};

/**
 * Validates quality inspection submission.
 */
const validateInspectionInput = ({ result, defectNotes, inspectorName }) => {
  if (!result || !VALID_INSPECTION_RESULTS.includes(result)) {
    return {
      valid: false,
      error: `Inspection result must be one of: ${VALID_INSPECTION_RESULTS.join(', ')}`,
      code: 'INVALID_INSPECTION_RESULT',
    };
  }

  const trimmedNotes = typeof defectNotes === 'string' ? defectNotes.trim() : '';

  if ((result === 'REWORK' || result === 'REJECT') && trimmedNotes.length === 0) {
    return {
      valid: false,
      error: `Defect notes are required when inspection result is '${result}'`,
      code: 'DEFECT_NOTES_REQUIRED',
    };
  }

  if (trimmedNotes.length > ROLL_LIMITS.MAX_DEFECT_NOTES_LENGTH) {
    return {
      valid: false,
      error: `Defect notes cannot exceed ${ROLL_LIMITS.MAX_DEFECT_NOTES_LENGTH} characters`,
      code: 'DEFECT_NOTES_TOO_LONG',
    };
  }

  let sanitizedInspector = null;
  if (inspectorName !== undefined && inspectorName !== null) {
    if (typeof inspectorName !== 'string') {
      return {
        valid: false,
        error: 'Inspector name must be a string',
        code: 'INVALID_INSPECTOR_NAME',
      };
    }
    sanitizedInspector = inspectorName.trim();
    if (sanitizedInspector.length > ROLL_LIMITS.MAX_INSPECTOR_NAME_LENGTH) {
      return {
        valid: false,
        error: `Inspector name cannot exceed ${ROLL_LIMITS.MAX_INSPECTOR_NAME_LENGTH} characters`,
        code: 'INSPECTOR_NAME_TOO_LONG',
      };
    }
  }

  return {
    valid: true,
    result,
    defectNotes: trimmedNotes,
    inspectorName: sanitizedInspector,
  };
};

/**
 * Evaluates allowed dispatch transition.
 */
const validateDispatchTransition = (currentDispatchStatus, currentQualityStatus, targetDispatchStatus) => {
  if (!VALID_DISPATCH_STATUSES.includes(targetDispatchStatus)) {
    return {
      valid: false,
      status: 422,
      error: `Invalid dispatch status '${targetDispatchStatus}'. Valid values: ${VALID_DISPATCH_STATUSES.join(', ')}`,
      code: 'INVALID_DISPATCH_STATUS',
    };
  }

  // 1. DISPATCHED is terminal
  if (currentDispatchStatus === 'DISPATCHED') {
    return {
      valid: false,
      status: 409,
      error: "Roll has already been dispatched. 'DISPATCHED' is a terminal state and cannot be modified.",
      code: 'ROLL_ALREADY_DISPATCHED',
    };
  }

  // 2. Unready transition (READY_FOR_DISPATCH -> NOT_DISPATCHED)
  if (targetDispatchStatus === 'NOT_DISPATCHED') {
    return { valid: true };
  }

  // 3. Advancing to READY_FOR_DISPATCH or DISPATCHED requires PASS quality
  if (targetDispatchStatus === 'READY_FOR_DISPATCH' || targetDispatchStatus === 'DISPATCHED') {
    if (currentQualityStatus !== 'PASS') {
      return {
        valid: false,
        status: 409,
        error: `Cannot mark roll as '${targetDispatchStatus}' because quality status is '${currentQualityStatus}'. Only 'PASS' rolls can be staged or dispatched.`,
        code: 'QUALITY_STATUS_NOT_PASS',
      };
    }
    return { valid: true };
  }

  return { valid: true };
};

/**
 * Computes allowed actions for the client UI.
 */
const calculateAllowedActions = (roll) => {
  const quality = roll.qualityStatus || 'PENDING';
  const dispatch = roll.dispatchStatus || 'NOT_DISPATCHED';

  const canInspect = dispatch !== 'DISPATCHED';
  const canMarkReady = quality === 'PASS' && dispatch === 'NOT_DISPATCHED';
  const canUnready = dispatch === 'READY_FOR_DISPATCH';
  const canDispatch = quality === 'PASS' && dispatch !== 'DISPATCHED';

  return {
    canInspect,
    canMarkReady,
    canUnready,
    canDispatch,
  };
};

module.exports = {
  validateRollId,
  validateQuantityMetres,
  validateInspectionInput,
  validateDispatchTransition,
  calculateAllowedActions,
};
