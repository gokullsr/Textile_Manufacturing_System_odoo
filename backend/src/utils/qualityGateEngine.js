/**
 * Pure Mathematical and Rules Engine for LoomIQ Stage Quality Gates & Quality Control Tower.
 * Zero database, React, or network dependencies — 100% deterministic and unit-testable.
 */

const {
  STAGE_ORDER,
  SEVERITY_WEIGHTS,
  QUALITY_RULES,
  STAGE_CONFIG,
  ALL_DEFECTS_MAP,
  getCatalogForStage,
} = require('../config/qualityStages.config');

const SEVERITY_RANKS = {
  PASS: 1,
  REWORK: 2,
  REJECT: 3,
};

/**
 * Validates defect list structure and stage catalog membership.
 */
const validateDefects = (defects, stageCode) => {
  if (!Array.isArray(defects)) {
    return { valid: false, error: 'Defects must be an array', code: 'INVALID_DEFECTS_FORMAT' };
  }

  const allowedCatalog = getCatalogForStage(stageCode);
  const allowedCodes = new Set(allowedCatalog.map((d) => d.code));

  for (let i = 0; i < defects.length; i++) {
    const item = defects[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Defect at index ${i} must be an object`, code: 'INVALID_DEFECT_ITEM' };
    }

    const { code, severity, quantity } = item;
    if (!code || typeof code !== 'string') {
      return { valid: false, error: `Defect code required at index ${i}`, code: 'MISSING_DEFECT_CODE' };
    }

    const normCode = code.trim().toUpperCase();
    if (!allowedCodes.has(normCode)) {
      return {
        valid: false,
        error: `Defect code '${normCode}' is not valid for stage '${stageCode}'`,
        code: 'INVALID_STAGE_DEFECT_CODE',
      };
    }

    const normSev = typeof severity === 'string' ? severity.trim().toUpperCase() : '';
    if (!['MINOR', 'MAJOR', 'CRITICAL'].includes(normSev)) {
      return {
        valid: false,
        error: `Defect severity at index ${i} must be MINOR, MAJOR, or CRITICAL`,
        code: 'INVALID_DEFECT_SEVERITY',
      };
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      return {
        valid: false,
        error: `Defect quantity at index ${i} must be an integer between 1 and 999`,
        code: 'INVALID_DEFECT_QUANTITY',
      };
    }
  }

  return { valid: true };
};

/**
 * Evaluates points and recommended verdict for a stage inspection.
 */
const evaluateInspection = ({
  stage,
  quantityMetres,
  defects = [],
  reworkCountAtStage = 0,
}) => {
  const stageConfig = STAGE_CONFIG[stage] || STAGE_CONFIG.GREY;
  const length = Number(quantityMetres);
  const validLength = !isNaN(length) && length > 0 ? length : 100;

  // 1. Calculate points
  let defectPoints = 0;
  let hasCritical = false;
  const breakdown = [];

  (defects || []).forEach((d) => {
    const qty = Math.max(0, parseInt(d.quantity, 10) || 0);
    const weight = SEVERITY_WEIGHTS[d.severity] || 0;
    const pts = qty * weight;
    defectPoints += pts;
    if (d.severity === 'CRITICAL' && qty > 0) {
      hasCritical = true;
    }
    const defInfo = ALL_DEFECTS_MAP[d.code] || { label: d.code };
    breakdown.push(`${qty} × ${defInfo.label} (${d.severity}=${weight}pts) = ${pts} pts`);
  });

  const pointsPer100m = validLength > 0 ? Math.round(((defectPoints / validLength) * 100) * 100) / 100 : 0;
  const safePointsPer100m = isFinite(pointsPer100m) ? pointsPer100m : 0;

  // 2. Determine recommended verdict in priority order
  let recommendedResult = 'PASS';
  let calculationSteps = [];
  let explanation = '';

  const passMax = stageConfig.passMaxPointsPer100m;
  const reworkMax = stageConfig.reworkMaxPointsPer100m;

  calculationSteps.push({
    label: 'Defect points total',
    expression: breakdown.length > 0 ? breakdown.join(' + ') : 'No defects recorded (0 points)',
    result: `${defectPoints} points`,
  });

  calculationSteps.push({
    label: 'Points per 100 metres',
    expression: `${defectPoints} points ÷ ${validLength} m × 100`,
    result: `${safePointsPer100m} pts/100m`,
  });

  if (hasCritical) {
    recommendedResult = 'REJECT';
    calculationSteps.push({
      label: 'Stage gate threshold evaluation',
      expression: 'Critical severity defect detected',
      result: 'REJECT (Immediate failure)',
    });
    explanation = `Contains critical defects; immediate REJECT required at ${stageConfig.shortLabel} gate.`;
  } else if (reworkCountAtStage >= QUALITY_RULES.MAX_REWORKS_PER_STAGE && safePointsPer100m > passMax) {
    recommendedResult = 'REJECT';
    calculationSteps.push({
      label: 'Stage gate threshold evaluation',
      expression: `${safePointsPer100m} pts/100m > ${passMax} limit with ${reworkCountAtStage} prior reworks (Max: ${QUALITY_RULES.MAX_REWORKS_PER_STAGE})`,
      result: 'REJECT (Rework limit reached)',
    });
    explanation = `Exceeded maximum allowable reworks (${QUALITY_RULES.MAX_REWORKS_PER_STAGE}) for stage ${stageConfig.shortLabel}. Automatic REJECT.`;
  } else if (safePointsPer100m <= passMax) {
    recommendedResult = 'PASS';
    calculationSteps.push({
      label: 'Stage gate threshold evaluation',
      expression: `${safePointsPer100m} pts/100m ≤ ${passMax} pass threshold`,
      result: 'PASS',
    });
    explanation = `Fabric meets ${stageConfig.shortLabel} quality standard (${safePointsPer100m} ≤ ${passMax} pts/100m). Gate passed.`;
  } else if (safePointsPer100m <= reworkMax) {
    recommendedResult = 'REWORK';
    calculationSteps.push({
      label: 'Stage gate threshold evaluation',
      expression: `${safePointsPer100m} pts/100m > ${passMax} pass limit and ≤ ${reworkMax} rework limit`,
      result: 'REWORK',
    });
    explanation = `Defect density (${safePointsPer100m} pts/100m) requires re-processing/rework before advancing beyond ${stageConfig.shortLabel}.`;
  } else {
    recommendedResult = 'REJECT';
    calculationSteps.push({
      label: 'Stage gate threshold evaluation',
      expression: `${safePointsPer100m} pts/100m > ${reworkMax} rework limit`,
      result: 'REJECT',
    });
    explanation = `Defect density (${safePointsPer100m} pts/100m) exceeds maximum allowable rework threshold (${reworkMax} pts/100m). Roll rejected.`;
  }

  return {
    defectPoints,
    pointsPer100m: safePointsPer100m,
    recommendedResult,
    calculation: calculationSteps,
    explanation,
    hasCritical,
    passMax,
    reworkMax,
  };
};

/**
 * Validates whether an inspector verdict constitutes an override and whether it requires justification.
 * Order: PASS (1) < REWORK (2) < REJECT (3).
 * Stricter is allowed without justification. Lenient requires overrideReason >= 10 chars.
 */
const validateOverride = (recommendedResult, actualResult, overrideReason) => {
  const recRank = SEVERITY_RANKS[recommendedResult] || 1;
  const actRank = SEVERITY_RANKS[actualResult] || 1;

  if (actRank < recRank) {
    // Lenient override
    const reasonStr = typeof overrideReason === 'string' ? overrideReason.trim() : '';
    if (reasonStr.length < 10) {
      return {
        valid: false,
        isOverride: true,
        error: `A more lenient verdict ('${actualResult}' vs recommended '${recommendedResult}') requires an override reason of at least 10 characters`,
        code: 'OVERRIDE_REASON_REQUIRED',
      };
    }
    return {
      valid: true,
      isOverride: true,
      overrideReason: reasonStr,
    };
  }

  // Same or stricter
  return {
    valid: true,
    isOverride: actRank !== recRank, // if stricter, isOverride can be true or false, but valid without reason
    overrideReason: typeof overrideReason === 'string' ? overrideReason.trim() : null,
  };
};

/**
 * Checks advance eligibility for a roll.
 */
const checkAdvanceEligibility = (roll, nextMachine) => {
  const currentStage = roll.stage || 'GREY';
  const quality = roll.qualityStatus || 'PENDING';
  const dispatch = roll.dispatchStatus || 'NOT_DISPATCHED';

  if (dispatch === 'DISPATCHED') {
    return {
      canAdvance: false,
      status: 409,
      code: 'ROLL_ALREADY_DISPATCHED',
      reason: 'Roll has already been dispatched.',
    };
  }

  if (currentStage === 'FINAL') {
    return {
      canAdvance: false,
      status: 409,
      code: 'FINAL_STAGE_REACHED',
      reason: 'Roll is already at FINAL inspection. No further processing stages exist.',
    };
  }

  if (quality === 'PENDING') {
    return {
      canAdvance: false,
      status: 409,
      code: 'GATE_NOT_PASSED',
      reason: `Roll has not been inspected at stage ${currentStage}. An inspection with PASS verdict is required to advance.`,
    };
  }

  if (quality === 'REWORK') {
    return {
      canAdvance: false,
      status: 409,
      code: 'GATE_NOT_PASSED',
      reason: `Stage ${currentStage} quality gate failed: REWORK required before advancing. Re-inspect after reprocessing.`,
    };
  }

  if (quality === 'REJECT') {
    return {
      canAdvance: false,
      status: 409,
      code: 'GATE_NOT_PASSED',
      reason: `Roll was REJECTED at stage ${currentStage}. Rejected rolls are permanently blocked from advancement.`,
    };
  }

  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const nextStage = STAGE_ORDER[currentIndex + 1];
  const nextStageConfig = STAGE_CONFIG[nextStage];

  // Machine verification
  if (nextStageConfig && nextStageConfig.machineTypes.length > 0) {
    if (!nextMachine) {
      return {
        canAdvance: false,
        status: 422,
        code: 'MACHINE_CODE_REQUIRED',
        reason: `Advancing to ${nextStageConfig.shortLabel} requires assigning an operational machine (${nextStageConfig.machineTypes.join(', ')}).`,
      };
    }

    if (!nextStageConfig.machineTypes.includes(nextMachine.type)) {
      return {
        canAdvance: false,
        status: 422,
        code: 'MACHINE_TYPE_MISMATCH',
        reason: `Machine '${nextMachine.code}' has type '${nextMachine.type}'. Stage ${nextStage} requires one of: ${nextStageConfig.machineTypes.join(', ')}.`,
      };
    }
  }

  return {
    canAdvance: true,
    nextStage,
    nextStageConfig,
  };
};

/**
 * Computes allowed actions for a roll passport view.
 */
const calculateEnhancedAllowedActions = (roll) => {
  const isFinal = !roll.stage || roll.stage === 'FINAL' || roll.stage === 'finished';
  const currentStage = roll.stage || (isFinal ? 'FINAL' : 'GREY');
  const quality = roll.qualityStatus || 'PENDING';
  const dispatch = roll.dispatchStatus || 'NOT_DISPATCHED';

  const isDispatched = dispatch === 'DISPATCHED';
  const isRejected = quality === 'REJECT';

  const canInspect = !isDispatched && !isRejected;

  let canAdvance = false;
  let blockReason = null;
  let nextStage = null;

  if (isDispatched) {
    blockReason = 'Roll is already dispatched.';
  } else if (isRejected) {
    blockReason = `Roll was REJECTED at ${currentStage}. Blocked from advancement.`;
  } else if (isFinal) {
    blockReason = 'Roll is at FINAL stage. Ready for dispatch staging once passed.';
  } else if (quality === 'PENDING') {
    blockReason = `Must complete and PASS ${currentStage} stage inspection before advancing.`;
  } else if (quality === 'REWORK') {
    blockReason = `Quality gate failed: REWORK required at ${currentStage} stage.`;
  } else if (quality === 'PASS') {
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    if (currentIndex >= 0 && currentIndex < STAGE_ORDER.length - 1) {
      nextStage = STAGE_ORDER[currentIndex + 1];
      canAdvance = true;
    }
  }

  // Dispatch rules: only when stage = FINAL and qualityStatus = PASS
  const canMarkReady = isFinal && quality === 'PASS' && dispatch === 'NOT_DISPATCHED';
  const canUnready = dispatch === 'READY_FOR_DISPATCH';
  const canDispatch = isFinal && quality === 'PASS' && !isDispatched;

  return {
    canInspect,
    canAdvance,
    nextStage,
    blockReason,
    canMarkReady,
    canUnready,
    canDispatch,
  };
};

/**
 * Pure analytics engine: Computes FPY, RTY, Escapes, Pareto, Hotspots, and Alerts.
 */
const computeQualityAnalytics = ({
  rolls = [],
  machines = [],
  correctiveActions = [],
  windowDays = 30,
  stageFilter = null,
  machineFilter = null,
  now = new Date(),
}) => {
  const nowDate = now instanceof Date ? now : new Date(now);
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const windowStart = new Date(nowDate.getTime() - windowMs);
  const alertWindowStart = new Date(nowDate.getTime() - QUALITY_RULES.ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recurrenceWindowStart = new Date(nowDate.getTime() - QUALITY_RULES.RECURRENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  if (!Array.isArray(rolls)) rolls = [];
  if (!Array.isArray(correctiveActions)) correctiveActions = [];

  // Group inspections by roll + stage to identify first-pass inspection
  // and gather stage statistics
  const stageStats = {};
  STAGE_ORDER.forEach((s) => {
    stageStats[s] = {
      stage: s,
      config: STAGE_CONFIG[s],
      inspectionsCount: 0,
      firstPassInspections: 0,
      firstPassPasses: 0,
      totalPasses: 0,
      totalReworks: 0,
      totalRejects: 0,
      totalPoints: 0,
      totalMetres: 0,
      awaitingInspection: 0,
      overdueInspection: 0,
    };
  });

  const allInspectionsInWindow = [];
  const machineFirstPassStats = {};
  const machineDefectOccurrences = {}; // machineCode -> defectCode -> [Date]
  const escapesList = [];
  let totalRejectsAllStages = 0;
  let finalRejectsCount = 0;
  const defectCounts = {}; // defectCode -> { count, points }

  // 1. Process Rolls
  const rollsOnHold = [];

  rolls.forEach((r) => {
    if (!r || typeof r !== 'object') return;
    const rollStage = r.stage || 'GREY';
    const rollQuality = r.qualityStatus || 'PENDING';
    const rollDispatch = r.dispatchStatus || 'NOT_DISPATCHED';
    const enteredAt = r.stageEnteredAt ? new Date(r.stageEnteredAt) : new Date(r.createdAt || nowDate);

    // Check rolls currently awaiting inspection / on hold
    const hasCurrentInspection = (r.inspections || []).some(
      (insp) => insp && (insp.stage || 'GREY') === rollStage
    );

    const hoursInStage = (nowDate.getTime() - enteredAt.getTime()) / (1000 * 60 * 60);
    const isOverdue = !hasCurrentInspection && rollDispatch !== 'DISPATCHED' && rollQuality !== 'REJECT' && hoursInStage > QUALITY_RULES.INSPECTION_SLA_HOURS;

    if (rollDispatch !== 'DISPATCHED') {
      if (rollQuality === 'PENDING') {
        stageStats[rollStage].awaitingInspection++;
        if (isOverdue) {
          stageStats[rollStage].overdueInspection++;
        }
      }
      if (rollQuality === 'REWORK' || rollQuality === 'REJECT' || isOverdue) {
        rollsOnHold.push({
          rollId: r.rollId,
          stage: rollStage,
          qualityStatus: rollQuality,
          quantityMetres: r.quantityMetres,
          orderNumber: r.order ? r.order.orderNumber : null,
          enteredAt,
          hoursInStage: Math.round(hoursInStage * 10) / 10,
          isOverdue,
          defectNotes: r.defectNotes || '',
        });
      }
    }

    // Process roll inspection history chronologically
    const stageFirstPassSeen = new Set();
    const validInspections = (r.inspections || []).filter(
      (insp) => insp && typeof insp === 'object'
    );
    const sortedInspections = validInspections.slice().sort((a, b) => {
      const aTime = a.inspectedAt ? new Date(a.inspectedAt).getTime() : 0;
      const bTime = b.inspectedAt ? new Date(b.inspectedAt).getTime() : 0;
      return aTime - bTime;
    });

    sortedInspections.forEach((insp) => {
      const inspDate = new Date(insp.inspectedAt || nowDate);
      const inspStage = insp.stage || 'GREY';
      const machineCode = insp.machineCode || (r.machine ? r.machine.code : 'UNKNOWN');
      const validDefects = (insp.defects || []).filter((d) => d && typeof d === 'object' && d.code);

      // Check escape: defect originStage earlier than inspection stage
      validDefects.forEach((def) => {
        const defMeta = ALL_DEFECTS_MAP[def.code];
        const originStage = defMeta ? defMeta.originStage : inspStage;
        if (originStage && STAGE_ORDER.indexOf(originStage) < STAGE_ORDER.indexOf(inspStage)) {
          escapesList.push({
            rollId: r.rollId,
            defectCode: def.code,
            defectLabel: defMeta ? defMeta.label : def.code,
            originStage,
            detectedStage: inspStage,
            severity: def.severity,
            quantity: def.quantity,
            inspectedAt: inspDate,
            machineCode,
          });
        }
      });

      // Track defect frequency on machine for recurrence
      if (!machineDefectOccurrences[machineCode]) {
        machineDefectOccurrences[machineCode] = {};
      }
      validDefects.forEach((def) => {
        if (!machineDefectOccurrences[machineCode][def.code]) {
          machineDefectOccurrences[machineCode][def.code] = [];
        }
        machineDefectOccurrences[machineCode][def.code].push({
          date: inspDate,
          rollId: r.rollId,
          quantity: def.quantity,
        });
      });

      // Window check for stage KPIs
      if (inspDate >= windowStart && inspDate <= nowDate) {
        // Filter checks for Pareto / stats
        const passStageFilter = !stageFilter || stageFilter === inspStage;
        const passMachineFilter = !machineFilter || machineFilter === machineCode;

        if (passStageFilter && passMachineFilter) {
          validDefects.forEach((def) => {
            if (!defectCounts[def.code]) {
              defectCounts[def.code] = { code: def.code, occurrences: 0, points: 0 };
            }
            const weight = SEVERITY_WEIGHTS[def.severity] || 1;
            const qty = def.quantity || 1;
            defectCounts[def.code].occurrences += qty;
            defectCounts[def.code].points += qty * weight;
          });
        }

        const stat = stageStats[inspStage];
        if (stat) {
          stat.inspectionsCount++;
          if (insp.result === 'PASS') stat.totalPasses++;
          if (insp.result === 'REWORK') stat.totalReworks++;
          if (insp.result === 'REJECT') stat.totalRejects++;
          stat.totalPoints += (insp.defectPoints || 0);
          stat.totalMetres += (r.quantityMetres || 0);

          if (!stageFirstPassSeen.has(inspStage)) {
            stageFirstPassSeen.add(inspStage);
            stat.firstPassInspections++;
            if (insp.result === 'PASS') {
              stat.firstPassPasses++;
            }

            // Track machine first-pass
            if (!machineFirstPassStats[machineCode]) {
              machineFirstPassStats[machineCode] = {
                machineCode,
                totalFirstPass: 0,
                nonPassCount: 0,
                defects: {},
              };
            }
            machineFirstPassStats[machineCode].totalFirstPass++;
            if (insp.result !== 'PASS') {
              machineFirstPassStats[machineCode].nonPassCount++;
              validDefects.forEach((d) => {
                machineFirstPassStats[machineCode].defects[d.code] = (machineFirstPassStats[machineCode].defects[d.code] || 0) + (d.quantity || 1);
              });
            }
          }
        }

        if (insp.result === 'REJECT') {
          totalRejectsAllStages++;
          if (inspStage === 'FINAL') {
            finalRejectsCount++;
          }
        }
      }
    });
  });

  // 2. Compute FPY per stage and Rolled Throughput Yield (RTY)
  let allStagesMeetMinSample = true;
  let rtyProduct = 1.0;

  const stageSummaries = STAGE_ORDER.map((stageKey) => {
    const s = stageStats[stageKey];
    const n = s.firstPassInspections;
    const isLowSample = n < QUALITY_RULES.MIN_SAMPLE;

    if (isLowSample) {
      allStagesMeetMinSample = false;
    }

    const fpy = isLowSample ? null : (n > 0 ? Math.round((s.firstPassPasses / n) * 1000) / 10 : null);
    if (!isLowSample && fpy !== null) {
      rtyProduct *= (fpy / 100);
    }

    const totalInsp = s.inspectionsCount;
    const reworkRate = totalInsp > 0 ? Math.round((s.totalReworks / totalInsp) * 1000) / 10 : 0;
    const rejectRate = totalInsp > 0 ? Math.round((s.totalRejects / totalInsp) * 1000) / 10 : 0;
    const avgPointsPer100m = s.totalMetres > 0 ? Math.round(((s.totalPoints / s.totalMetres) * 100) * 10) / 10 : 0;

    return {
      stage: stageKey,
      label: s.config.label,
      shortLabel: s.config.shortLabel,
      inspected: totalInsp,
      firstPassInspections: n,
      fpy,
      sampleSize: n,
      lowSample: isLowSample,
      reworkRate,
      rejectRate,
      avgPointsPer100m,
      awaitingInspection: s.awaitingInspection,
      overdueInspection: s.overdueInspection,
    };
  });

  const rty = allStagesMeetMinSample ? Math.round(rtyProduct * 1000) / 10 : null;
  const rtyExplanation = allStagesMeetMinSample
    ? `Rolled Throughput Yield: ${rty}% across all 4 production gates.`
    : `RTY calculation suspended: One or more stages have fewer than minimum sample size (${QUALITY_RULES.MIN_SAMPLE}).`;

  // 3. Late Detection Rate
  const lateDetectionRate = totalRejectsAllStages > 0
    ? Math.round((finalRejectsCount / totalRejectsAllStages) * 1000) / 10
    : 0;

  // 4. Pareto Analysis
  const totalDefectPoints = Object.values(defectCounts).reduce((sum, d) => sum + d.points, 0);
  const sortedPareto = Object.values(defectCounts).sort((a, b) => b.points - a.points);
  let cumulativePoints = 0;

  const pareto = sortedPareto.map((d) => {
    cumulativePoints += d.points;
    const cumPct = totalDefectPoints > 0 ? Math.round((cumulativePoints / totalDefectPoints) * 1000) / 10 : 0;
    const defInfo = ALL_DEFECTS_MAP[d.code] || { label: d.code, originStage: 'UNKNOWN' };
    return {
      code: d.code,
      label: defInfo.label,
      originStage: defInfo.originStage,
      occurrences: d.occurrences,
      points: d.points,
      cumulativePercent: cumPct,
    };
  });

  // 5. Machine Hotspots
  const hotspots = Object.values(machineFirstPassStats).map((m) => {
    const isLow = m.totalFirstPass < QUALITY_RULES.MIN_SAMPLE;
    const nonPassRate = m.totalFirstPass > 0 ? Math.round((m.nonPassCount / m.totalFirstPass) * 1000) / 1000 : 0;
    const topDefectEntry = Object.entries(m.defects).sort((a, b) => b[1] - a[1])[0];
    const topDefect = topDefectEntry ? { code: topDefectEntry[0], count: topDefectEntry[1] } : null;

    return {
      machineCode: m.machineCode,
      totalFirstPass: m.totalFirstPass,
      nonPassCount: m.nonPassCount,
      nonPassRate: isLow ? null : nonPassRate,
      lowSample: isLow,
      isHotspot: !isLow && nonPassRate >= QUALITY_RULES.MACHINE_ALERT_WARN_RATE,
      topDefect,
    };
  });

  // 6. Generate Rule-Based Alerts (Computed on read, never stored)
  const alerts = [];

  // Alert A: MACHINE_DEFECT_RATE
  Object.values(machineFirstPassStats).forEach((m) => {
    if (m.totalFirstPass >= QUALITY_RULES.MIN_SAMPLE) {
      const rate = m.nonPassCount / m.totalFirstPass;
      if (rate >= QUALITY_RULES.MACHINE_ALERT_WARN_RATE) {
        const severity = rate >= QUALITY_RULES.MACHINE_ALERT_CRITICAL_RATE ? 'CRITICAL' : 'WARN';
        const topDefectEntry = Object.entries(m.defects).sort((a, b) => b[1] - a[1])[0];
        const topDefLabel = topDefectEntry ? (ALL_DEFECTS_MAP[topDefectEntry[0]]?.label || topDefectEntry[0]) : 'None';
        const topDefQty = topDefectEntry ? topDefectEntry[1] : 0;

        alerts.push({
          key: `ALERT_MACHINE_${m.machineCode}_${severity}`,
          type: 'MACHINE_DEFECT_RATE',
          severity,
          title: `High Defect Rate on ${m.machineCode}`,
          explanation: `${m.machineCode}: ${m.nonPassCount} of ${m.totalFirstPass} first-pass inspections in the window were REWORK/REJECT (${Math.round(rate * 100)}%). Most frequent defect: ${topDefLabel} (${topDefQty}).`,
          evidence: {
            machineCode: m.machineCode,
            totalInspections: m.totalFirstPass,
            nonPassCount: m.nonPassCount,
            nonPassRate: Math.round(rate * 1000) / 10,
            topDefect: topDefectEntry ? { code: topDefectEntry[0], count: topDefQty } : null,
          },
          machineCode: m.machineCode,
          suggestedAction: `Inspect mechanical alignment, tension guides, and calibration on workcenter ${m.machineCode}.`,
        });
      }
    }
  });

  // Alert B: INSPECTION_OVERDUE
  rolls.forEach((r) => {
    if (!r || typeof r !== 'object') return;
    const rollStage = r.stage || 'GREY';
    const rollQuality = r.qualityStatus || 'PENDING';
    const rollDispatch = r.dispatchStatus || 'NOT_DISPATCHED';
    const enteredAt = r.stageEnteredAt ? new Date(r.stageEnteredAt) : new Date(r.createdAt || nowDate);
    const hasCurrentInspection = (r.inspections || []).some((insp) => insp && (insp.stage || 'GREY') === rollStage);
    const hoursInStage = (nowDate.getTime() - enteredAt.getTime()) / (1000 * 60 * 60);

    if (!hasCurrentInspection && rollDispatch !== 'DISPATCHED' && rollQuality !== 'REJECT' && hoursInStage > QUALITY_RULES.INSPECTION_SLA_HOURS) {
      alerts.push({
        key: `ALERT_OVERDUE_${r.rollId}_${rollStage}`,
        type: 'INSPECTION_OVERDUE',
        severity: 'WARN',
        title: `Inspection SLA Breached: ${r.rollId}`,
        explanation: `Roll ${r.rollId} has been awaiting inspection at stage ${rollStage} for ${Math.round(hoursInStage * 10) / 10} hours (SLA: ${QUALITY_RULES.INSPECTION_SLA_HOURS}h).`,
        evidence: {
          rollId: r.rollId,
          stage: rollStage,
          hoursWaiting: Math.round(hoursInStage * 10) / 10,
          slaHours: QUALITY_RULES.INSPECTION_SLA_HOURS,
        },
        stage: rollStage,
        relatedRolls: [r.rollId],
        suggestedAction: `Dispatch quality inspector immediately to examine roll ${r.rollId} at ${rollStage} staging.`,
      });
    }
  });

  // Alert C: REWORK_LIMIT
  rolls.forEach((r) => {
    if (!r || typeof r !== 'object') return;
    const rollStage = r.stage || 'GREY';
    const reworksAtCurrentStage = (r.inspections || []).filter(
      (insp) => insp && (insp.stage || 'GREY') === rollStage && insp.result === 'REWORK'
    ).length;

    if (reworksAtCurrentStage >= QUALITY_RULES.MAX_REWORKS_PER_STAGE && r.qualityStatus !== 'PASS' && r.dispatchStatus !== 'DISPATCHED') {
      alerts.push({
        key: `ALERT_REWORK_LIMIT_${r.rollId}_${rollStage}`,
        type: 'REWORK_LIMIT',
        severity: 'CRITICAL',
        title: `Rework Limit Exceeded: ${r.rollId}`,
        explanation: `Roll ${r.rollId} has reached the maximum permitted reworks (${QUALITY_RULES.MAX_REWORKS_PER_STAGE}) at stage ${rollStage}. Further reprocessing blocked.`,
        evidence: {
          rollId: r.rollId,
          stage: rollStage,
          reworkCount: reworksAtCurrentStage,
          maxAllowed: QUALITY_RULES.MAX_REWORKS_PER_STAGE,
        },
        stage: rollStage,
        relatedRolls: [r.rollId],
        suggestedAction: `Perform scrap assessment or initiate quarantine deviation approval for roll ${r.rollId}.`,
      });
    }
  });

  // Alert D: RECURRING_DEFECT
  Object.entries(machineDefectOccurrences).forEach(([machCode, defectMap]) => {
    Object.entries(defectMap).forEach(([defCode, occurrences]) => {
      // Filter occurrences within recurrence window
      const recentOccurrences = occurrences.filter((occ) => occ.date >= recurrenceWindowStart && occ.date <= nowDate);
      if (recentOccurrences.length >= QUALITY_RULES.RECURRENCE_THRESHOLD) {
        const defMeta = ALL_DEFECTS_MAP[defCode] || { label: defCode };
        const matchingCA = correctiveActions.find(
          (ca) => (ca.machineCode === machCode || ca.machine?.code === machCode) && ca.defectCode === defCode
        );

        alerts.push({
          key: `ALERT_RECURRING_${machCode}_${defCode}`,
          type: 'RECURRING_DEFECT',
          severity: 'WARN',
          title: `Recurring Defect on ${machCode}: ${defMeta.label}`,
          explanation: `Defect '${defMeta.label}' occurred ${recentOccurrences.length} times on ${machCode} in the last ${QUALITY_RULES.RECURRENCE_WINDOW_DAYS} days (threshold: ${QUALITY_RULES.RECURRENCE_THRESHOLD}).`,
          evidence: {
            machineCode: machCode,
            defectCode: defCode,
            defectLabel: defMeta.label,
            occurrencesCount: recentOccurrences.length,
            threshold: QUALITY_RULES.RECURRENCE_THRESHOLD,
            windowDays: QUALITY_RULES.RECURRENCE_WINDOW_DAYS,
            hasCorrectiveAction: !!matchingCA,
            correctiveActionNumber: matchingCA ? matchingCA.actionNumber : null,
          },
          machineCode: machCode,
          relatedRolls: recentOccurrences.map((o) => o.rollId),
          suggestedAction: matchingCA
            ? `Review open Corrective Action ${matchingCA.actionNumber}.`
            : `Open a new Corrective Action (CAPA) to eliminate root cause of '${defMeta.label}' on ${machCode}.`,
        });
      }
    });
  });

  // Sort alerts: CRITICAL first, then WARN, then alphabetical key
  alerts.sort((a, b) => {
    if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
    if (a.severity !== 'CRITICAL' && b.severity === 'CRITICAL') return 1;
    return a.key.localeCompare(b.key);
  });

  return {
    windowDays,
    asOf: nowDate.toISOString(),
    stages: stageSummaries,
    rty,
    rtyExplanation,
    lateDetectionRate,
    totalRejects: totalRejectsAllStages,
    finalRejects: finalRejectsCount,
    escapes: {
      count: escapesList.length,
      topEscapes: escapesList.slice(0, 10),
    },
    pareto,
    hotspots,
    rollsOnHold,
    alerts,
  };
};

/**
 * 4C: Corrective Action Recurrence Tracker.
 * For an action with defectCode & machineCode, count occurrences after doneAt.
 */
const calculateActionRecurrence = (action, rolls = [], now = new Date()) => {
  if (!Array.isArray(rolls)) rolls = [];
  if (!action || typeof action !== 'object') {
    return {
      recurred: false,
      recurrencesSinceFix: 0,
      explanation: 'No recurrence tracking active (invalid action).',
      verificationFailed: false,
    };
  }

  const machineCode = action.machineCode || (action.machine ? action.machine.code : null);
  const defectCode = action.defectCode;
  const doneAt = action.doneAt ? new Date(action.doneAt) : null;

  if (!machineCode || !defectCode || !doneAt) {
    return {
      recurred: false,
      recurrencesSinceFix: 0,
      explanation: 'No recurrence tracking active (requires machine, defect code, and completion date).',
      verificationFailed: false,
    };
  }

  let recurrencesCount = 0;
  const matchingRolls = [];

  rolls.forEach((r) => {
    if (!r || typeof r !== 'object') return;
    (r.inspections || []).forEach((insp) => {
      if (!insp || typeof insp !== 'object') return;
      const inspDate = new Date(insp.inspectedAt || now);
      const inspMachine = insp.machineCode || (r.machine ? r.machine.code : null);
      if (inspDate > doneAt && inspMachine === machineCode) {
        (insp.defects || []).forEach((d) => {
          if (d.code === defectCode) {
            const qty = d.quantity || 1;
            recurrencesCount += qty;
            matchingRolls.push({
              rollId: r.rollId,
              date: inspDate,
              quantity: qty,
            });
          }
        });
      }
    });
  });

  const defMeta = ALL_DEFECTS_MAP[defectCode] || { label: defectCode };
  const recurred = recurrencesCount > 0;
  const verificationFailed = action.status === 'VERIFIED' && recurred;

  let explanation = '';
  if (recurred) {
    explanation = `${defMeta.label} occurred ${recurrencesCount} time(s) on ${machineCode} after this action was marked done on ${doneAt.toLocaleDateString()}.`;
  } else {
    explanation = `Zero recurrences of ${defMeta.label} recorded on ${machineCode} since fix on ${doneAt.toLocaleDateString()}.`;
  }

  return {
    recurred,
    recurrencesSinceFix: recurrencesCount,
    matchingRolls,
    explanation,
    verificationFailed,
  };
};

module.exports = {
  validateDefects,
  evaluateInspection,
  validateOverride,
  checkAdvanceEligibility,
  calculateEnhancedAllowedActions,
  computeQualityAnalytics,
  calculateActionRecurrence,
};
