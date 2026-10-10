/**
 * Dashboard Controller.
 * Computes live operational metrics directly from MongoDB collections.
 */
const { ProductionOrder, Machine, MaterialStock } = require('../models');
const { calculateOrderMetrics, calculateStockMetrics } = require('../utils/derivedMetrics');

/**
 * GET /api/dashboard/summary
 * Returns comprehensive factory telemetry KPIs, attention items, machine statuses, and stock warnings.
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    // 1. Query all orders, machines, and stocks concurrently
    const [orders, machines, stockItems] = await Promise.all([
      ProductionOrder.find().populate('assignedMachine').lean(),
      Machine.find().populate('currentAssignedOrder').lean(),
      MaterialStock.find().lean(),
    ]);

    const now = new Date();

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
          attentionOrders.push({
            ...order,
            ...metrics,
          });
        } else if (metrics.delayStatus === 'at_risk') {
          atRiskCount++;
          attentionOrders.push({
            ...order,
            ...metrics,
          });
        } else if (metrics.delayStatus === 'insufficient_data') {
          insufficientDataCount++;
          attentionOrders.push({
            ...order,
            ...metrics,
          });
        } else {
          onTrackCount++;
        }
      }
    });

    // Sort attention orders: delayed first, then at_risk, then insufficient_data
    attentionOrders.sort((a, b) => {
      const severity = { delayed: 1, at_risk: 2, insufficient_data: 3, on_track: 4 };
      const sevA = severity[a.delayStatus] || 5;
      const sevB = severity[b.delayStatus] || 5;
      if (sevA !== sevB) return sevA - sevB;
      return (a.daysRemaining || 0) - (b.daysRemaining || 0);
    });

    // 3. Compute machine metrics
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

    // 4. Compute stock metrics
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let okStockCount = 0;
    const stockWarnings = [];

    stockItems.forEach((item) => {
      const metrics = calculateStockMetrics(item);
      if (metrics.stockLevel === 'out') {
        outOfStockCount++;
        stockWarnings.push({
          ...item,
          ...metrics,
        });
      } else if (metrics.stockLevel === 'low') {
        lowStockCount++;
        stockWarnings.push({
          ...item,
          ...metrics,
        });
      } else {
        okStockCount++;
      }
    });

    // Sort stock warnings: out of stock first, then by highest shortfall
    stockWarnings.sort((a, b) => {
      if (a.stockLevel === 'out' && b.stockLevel !== 'out') return -1;
      if (b.stockLevel === 'out' && a.stockLevel !== 'out') return 1;
      return b.shortfall - a.shortfall;
    });

    // 5. Structure clean response shape
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
      attentionOrders: attentionOrders.slice(0, 5), // Top 5 urgent orders
      stockWarnings: stockWarnings.slice(0, 5),     // Top 5 critical stock items
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
