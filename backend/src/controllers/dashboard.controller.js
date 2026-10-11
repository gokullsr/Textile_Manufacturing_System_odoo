/**
 * Dashboard Controller.
 * Computes live operational telemetry KPIs and real server-side recent activity records.
 */
const { ProductionOrder, Machine, MaterialStock, MaterialMovement, FabricRoll, CorrectiveAction } = require('../models');
const { calculateOrderMetrics, calculateStockMetrics } = require('../utils/derivedMetrics');
const { computeQualityAnalytics } = require('../utils/qualityGateEngine');

/**
 * GET /api/dashboard/summary
 * Returns comprehensive factory telemetry KPIs, attention items, machine statuses,
 * stock warnings, quality alerts, and real server-side activity feed.
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    const now = new Date();

    // 1. Concurrent queries across domain entities
    const [orders, machines, stockItems, movements, rolls, correctiveActions] = await Promise.all([
      ProductionOrder.find().populate('assignedMachine').lean(),
      Machine.find().populate('currentAssignedOrder').lean(),
      MaterialStock.find().lean(),
      MaterialMovement.find().sort('-timestamp').limit(10).lean(),
      FabricRoll.find().lean(),
      CorrectiveAction.find().lean(),
    ]);

    // 2. Compute order metrics
    let activeOrders = 0;
    let completedOrders = 0;
    let delayedCount = 0;
    let atRiskCount = 0;
    let onTrackCount = 0;
    let insufficientDataCount = 0;

    const statusCounts = {
      queued: 0,
      in_progress: 0,
      completed: 0,
      on_hold: 0,
      draft: 0,
      planned: 0,
      cancelled: 0,
    };

    const attentionOrders = [];

    orders.forEach((order) => {
      const status = order.status || 'queued';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status === 'completed') {
        completedOrders++;
      } else if (status !== 'cancelled') {
        activeOrders++;
        const metrics = calculateOrderMetrics(order, now);

        if (metrics.delayStatus === 'delayed') {
          delayedCount++;
          attentionOrders.push({ ...order, ...metrics });
        } else if (metrics.delayStatus === 'at_risk') {
          atRiskCount++;
          attentionOrders.push({ ...order, ...metrics });
        } else if (metrics.delayStatus === 'insufficient_data') {
          insufficientDataCount++;
          attentionOrders.push({ ...order, ...metrics });
        } else {
          onTrackCount++;
        }
      }
    });

    attentionOrders.sort((a, b) => {
      const severity = { delayed: 1, at_risk: 2, insufficient_data: 3, on_track: 4 };
      const sevA = severity[a.delayStatus] || 5;
      const sevB = severity[b.delayStatus] || 5;
      if (sevA !== sevB) return sevA - sevB;
      return (a.daysRemaining || 0) - (b.daysRemaining || 0);
    });

    const machinesByState = {
      available: 0,
      running: 0,
      maintenance: 0,
      idle: 0,
      breakdown: 0,
      offline: 0,
      total: machines.length,
    };

    machines.forEach((m) => {
      const state = m.status || 'available';
      machinesByState[state] = (machinesByState[state] || 0) + 1;
    });

    // 4. Compute stock metrics (Single Source of Truth)
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let okStockCount = 0;
    const stockWarnings = [];

    stockItems.forEach((item) => {
      const metrics = calculateStockMetrics(item);
      const enriched = {
        ...item,
        ...metrics,
        suggestedReorderQuantity: metrics.shortfall > 0 ? metrics.shortfall + Math.ceil(item.reorderLevel * 0.5) : 0,
      };

      if (metrics.stockLevel === 'out') {
        outOfStockCount++;
        stockWarnings.push(enriched);
      } else if (metrics.stockLevel === 'low') {
        lowStockCount++;
        stockWarnings.push(enriched);
      } else {
        okStockCount++;
      }
    });

    stockWarnings.sort((a, b) => {
      if (a.stockLevel === 'out' && b.stockLevel !== 'out') return -1;
      if (b.stockLevel === 'out' && a.stockLevel !== 'out') return 1;
      return b.shortfall - a.shortfall;
    });

    // 5. Build Recent Activity from Real Records
    const activities = [];

    // 5a. Stock movements
    movements.forEach((m) => {
      activities.push({
        id: `mvt-${m._id}`,
        type: 'STOCK_MOVEMENT',
        title: `Stock ${m.type}: ${m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} ${m.unit} (${m.sku})`,
        description: m.reason || 'Inventory adjustment',
        timestamp: m.timestamp,
        actor: m.actor ? m.actor.name : 'Operator',
        badge: m.type,
      });
    });

    // 5b. Inspections and Dispatches from Fabric Rolls
    rolls.forEach((r) => {
      (r.inspections || []).forEach((insp, idx) => {
        activities.push({
          id: `insp-${r.rollId}-${idx}`,
          type: 'QUALITY_INSPECTION',
          title: `Inspection ${insp.result} at ${insp.stage} (${r.rollId})`,
          description: insp.defectNotes || `${insp.defects?.length || 0} defects recorded`,
          timestamp: insp.inspectedAt || r.updatedAt,
          actor: insp.inspectorName || insp.inspectedBy?.name || 'QA Inspector',
          badge: insp.result,
        });
      });

      if (r.dispatchStatus === 'DISPATCHED' && r.dispatchedAt) {
        activities.push({
          id: `disp-${r.rollId}`,
          type: 'DISPATCH',
          title: `Roll Dispatched (${r.rollId})`,
          description: `${r.quantityMetres}m released to dispatch`,
          timestamp: r.dispatchedAt,
          actor: r.dispatchedBy?.name || 'Dispatch Officer',
          badge: 'DISPATCHED',
        });
      }
    });

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 6. Quality Control Tower live alerts
    let qualityAlerts = [];
    try {
      const qAnalytics = computeQualityAnalytics({
        rolls,
        machines,
        correctiveActions,
        windowDays: 30,
        now,
      });
      qualityAlerts = qAnalytics.alerts || [];
    } catch (e) {
      qualityAlerts = [];
    }

    return res.status(200).json({
      timestamp: now.toISOString(),
      kpis: {
        activeOrders,
        completedOrders,
        delayedOrders: delayedCount,
        atRiskOrders: atRiskCount,
        onTrackOrders: onTrackCount,
        insufficientDataOrders: insufficientDataCount,
        insufficientData: insufficientDataCount,
        totalOrders: orders.length,
        machines: {
          available: machinesByState.available + machinesByState.idle,
          running: machinesByState.running,
          maintenance: machinesByState.maintenance + machinesByState.breakdown,
          total: machines.length,
        },
        stock: {
          outOfStock: outOfStockCount,
          lowStock: lowStockCount,
          healthyStock: okStockCount,
          totalItems: stockItems.length,
        },
      },
      attentionOrders: attentionOrders.slice(0, 5),
      stockWarnings: stockWarnings.slice(0, 5),
      recentActivity: activities.slice(0, 10),
      qualityAlerts: qualityAlerts.slice(0, 4),
      ordersByStatus: Object.entries(statusCounts)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({ status, count })),
      machineSummary: machines.map((m) => ({
        _id: m._id,
        code: m.code,
        name: m.name,
        type: m.type,
        status: m.status,
        currentOrderNumber: m.currentAssignedOrder?.orderNumber || null,
        buyer: m.currentAssignedOrder?.customer || null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary,
};
