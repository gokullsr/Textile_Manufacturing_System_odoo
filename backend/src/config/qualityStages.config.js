/**
 * Quality Stages & Gate Configuration (Single Source of Truth)
 *
 * NOTE: All thresholds, defect catalogs, and scoring weights defined here are DEMO PLACEHOLDERS
 * configured for demonstration/hackathon purposes. In production, these must be configured
 * against the mill's formal standard operating procedures (SOPs) or ASTM D5430 4-point standard.
 */

const STAGE_ORDER = ['GREY', 'DYEING', 'FINISHING', 'FINAL'];

const SEVERITY_WEIGHTS = {
  MINOR: 1,
  MAJOR: 3,
  CRITICAL: 5,
};

const QUALITY_RULES = {
  MAX_REWORKS_PER_STAGE: 2,
  INSPECTION_SLA_HOURS: 4,
  MIN_SAMPLE: 5,
  ALERT_WINDOW_DAYS: 7,
  MACHINE_ALERT_WARN_RATE: 0.30,
  MACHINE_ALERT_CRITICAL_RATE: 0.50,
  RECURRENCE_WINDOW_DAYS: 14,
  RECURRENCE_THRESHOLD: 3,
};

const STAGE_DEFECT_CATALOG = {
  GREY: [
    { code: 'BROKEN_END', label: 'Broken End', originStage: 'GREY' },
    { code: 'WEFT_BAR', label: 'Weft Bar', originStage: 'GREY' },
    { code: 'SLUB', label: 'Slub', originStage: 'GREY' },
    { code: 'HOLE', label: 'Hole', originStage: 'GREY' },
    { code: 'OIL_STAIN', label: 'Oil Stain', originStage: 'GREY' },
    { code: 'DROPPED_STITCH', label: 'Dropped Stitch', originStage: 'GREY' },
  ],
  DYEING: [
    { code: 'SHADE_VARIATION', label: 'Shade Variation', originStage: 'DYEING' },
    { code: 'UNEVEN_DYEING', label: 'Uneven Dyeing', originStage: 'DYEING' },
    { code: 'COLOR_BLEEDING', label: 'Color Bleeding', originStage: 'DYEING' },
    { code: 'DYE_STAIN', label: 'Dye Stain', originStage: 'DYEING' },
    { code: 'CREASE_MARK', label: 'Crease Mark', originStage: 'DYEING' },
  ],
  FINISHING: [
    { code: 'WRINKLES', label: 'Wrinkles', originStage: 'FINISHING' },
    { code: 'SKEW_BOWING', label: 'Skew / Bowing', originStage: 'FINISHING' },
    { code: 'HANDFEEL_ISSUE', label: 'Handfeel Issue', originStage: 'FINISHING' },
    { code: 'FINISH_SPOT', label: 'Finish Spot', originStage: 'FINISHING' },
  ],
  FINAL: [
    { code: 'PACKING_DEFECT', label: 'Packing Defect', originStage: 'FINAL' },
    { code: 'LABEL_ERROR', label: 'Label Error', originStage: 'FINAL' },
  ],
};

// All upstream defect codes are also permitted at FINAL inspection (escaped defects)
const ALL_DEFECTS_MAP = {};
Object.entries(STAGE_DEFECT_CATALOG).forEach(([stage, defects]) => {
  defects.forEach((d) => {
    ALL_DEFECTS_MAP[d.code] = { ...d, originStage: d.originStage || stage };
  });
});

const STAGE_CONFIG = {
  GREY: {
    code: 'GREY',
    label: 'Weaving / Knitting (grey fabric)',
    shortLabel: 'Grey Fabric',
    machineTypes: ['loom', 'knitting_machine'],
    passMaxPointsPer100m: 20,
    reworkMaxPointsPer100m: 40,
    isFinal: false,
    nextStage: 'DYEING',
  },
  DYEING: {
    code: 'DYEING',
    label: 'Dyeing / Processing',
    shortLabel: 'Dyeing',
    machineTypes: ['dyeing_vat'],
    passMaxPointsPer100m: 10,
    reworkMaxPointsPer100m: 25,
    isFinal: false,
    nextStage: 'FINISHING',
  },
  FINISHING: {
    code: 'FINISHING',
    label: 'Finishing',
    shortLabel: 'Finishing',
    machineTypes: ['finishing_range'],
    passMaxPointsPer100m: 10,
    reworkMaxPointsPer100m: 20,
    isFinal: false,
    nextStage: 'FINAL',
  },
  FINAL: {
    code: 'FINAL',
    label: 'Final inspection',
    shortLabel: 'Final QC',
    machineTypes: [],
    passMaxPointsPer100m: 8,
    reworkMaxPointsPer100m: 15,
    isFinal: true,
    nextStage: null,
  },
};

/**
 * Returns allowed defect catalog for a stage.
 * For FINAL stage, it includes native FINAL defects PLUS all upstream defects.
 */
const getCatalogForStage = (stageCode) => {
  if (stageCode === 'FINAL') {
    // Return all defects across all stages
    return Object.values(ALL_DEFECTS_MAP);
  }
  return STAGE_DEFECT_CATALOG[stageCode] || [];
};

module.exports = {
  STAGE_ORDER,
  SEVERITY_WEIGHTS,
  QUALITY_RULES,
  STAGE_CONFIG,
  STAGE_DEFECT_CATALOG,
  ALL_DEFECTS_MAP,
  getCatalogForStage,
};
