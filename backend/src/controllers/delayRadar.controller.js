const { ProductionOrder, Machine, FabricRoll } = require('../models');
const { evaluateOrderRisk } = require('../utils/delayRadarEngine');
const { FACTORY_TIMEZONE, NON_WORKING_WEEKDAYS, TOLERANCE } = require('../config/radar.config');
const { escapeRegex } = require('../utils/derivedMetrics');

const ORDER_NUMBER_REGEX = /^PO-[A-Z0-9-]+$/i;
const ALLOWED_RADAR_STATUSES = ['OVERDUE', 'AT_RISK', 'ON_TRACK', 'INSUFFICIENT_DATA', 'COMPLETED'];
const ALLOWED_SORT_OPTIONS = ['severity', 'dueDate', 'daysLate', 'slackDays', 'orderNumber', 'buyer'];

const getRadarAssessments = async (req, res, next) => {
  try {
    const { status, search, sort = 'severity' } = req.query;

    let normalizedStatus = null;
    if (status) {
      normalizedStatus = status.trim().toUpperCase();
      if (!ALLOWED_RADAR_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          error: {
            message: `Invalid status filter '${status}'. Allowed values: ${ALLOWED_RADAR_STATUSES.join(', ')}`,
            code: 'INVALID_STATUS_FILTER',
          },
        });
      }
    }

    if (sort && !ALLOWED_SORT_OPTIONS.includes(sort)) {
      return res.status(400).json({
        error: {
          message: `Invalid sort option '${sort}'. Allowed options: ${ALLOWED_SORT_OPTIONS.join(', ')}`,
          code: 'INVALID_SORT_OPTION',
        },
      });
    }

    const activeStatuses = ['queued', 'in_progress', 'on_hold', 'draft', 'planned'];

    const [orders, allMachines, defectRolls] = await Promise.all([
      ProductionOrder.find({ status: { $in: activeStatuses } })
        .populate('assignedMachine')
        .lean(),
      Machine.find().lean(),
      FabricRoll.find({ qualityStatus: { $in: ['REJECT', 'REWORK'] } }).lean(),
    ]);

    const now = new Date();

    const availableMachinesByType = {};
    allMachines.forEach((m) => {
      if (m.status === 'available') {
        const type = m.type || 'generic';
        if (!availableMachinesByType[type]) {
          availableMachinesByType[type] = [];
        }
        availableMachinesByType[type].push(m);
      }
    });

    const machineAssignmentCounts = {};
    orders.forEach((o) => {
      if (o.assignedMachine && o.assignedMachine._id) {
        const mId = o.assignedMachine._id.toString();
        machineAssignmentCounts[mId] = (machineAssignmentCounts[mId] || 0) + 1;
      }
    });

    const rollDefectsByOrder = {};
    defectRolls.forEach((roll) => {
      const orderKey = roll.order ? roll.order.toString() : null;
      if (orderKey) {
        if (!rollDefectsByOrder[orderKey]) {
          rollDefectsByOrder[orderKey] = { count: 0, metres: 0 };
        }
        rollDefectsByOrder[orderKey].count += 1;
        rollDefectsByOrder[orderKey].metres += Number(roll.quantityMetres) || 0;
      }
    });

    let assessments = orders.map((order) => {
      const orderMachineType = order.assignedMachine?.type || 'loom';
      const availableSameTypeMachines = availableMachinesByType[orderMachineType] || [];
      const mId = order.assignedMachine?._id ? order.assignedMachine._id.toString() : null;
      const sharedCount = mId ? (machineAssignmentCounts[mId] || 0) : 0;

      const orderIdStr = order._id ? order._id.toString() : null;
      const defects = orderIdStr ? rollDefectsByOrder[orderIdStr] : null;

      return evaluateOrderRisk(order, now, {
        availableSameTypeMachines,
        sharedActiveOrdersCount: sharedCount,
        rejectReworkRolls: defects,
      });
    });

    const summary = {
      overdue: assessments.filter((a) => a.status === 'OVERDUE').length,
      atRisk: assessments.filter((a) => a.status === 'AT_RISK').length,
      onTrack: assessments.filter((a) => a.status === 'ON_TRACK').length,
      insufficientData: assessments.filter((a) => a.status === 'INSUFFICIENT_DATA').length,
      total: assessments.length,
    };

    if (normalizedStatus) {
      assessments = assessments.filter((a) => a.status === normalizedStatus);
    }

    if (search && search.trim() !== '') {
      const searchTerms = search.trim().toLowerCase();
      assessments = assessments.filter(
        (a) =>
          (a.orderNumber && a.orderNumber.toLowerCase().includes(searchTerms)) ||
          (a.buyer && a.buyer.toLowerCase().includes(searchTerms)) ||
          (a.fabricType && a.fabricType.toLowerCase().includes(searchTerms))
      );
    }

    assessments.sort((a, b) => {
      if (sort === 'severity') {
        const rank = { OVERDUE: 1, AT_RISK: 2, INSUFFICIENT_DATA: 3, ON_TRACK: 4, COMPLETED: 5 };
        const rankA = rank[a.status] || 99;
        const rankB = rank[b.status] || 99;
        if (rankA !== rankB) return rankA - rankB;

        if (a.status === 'AT_RISK' && b.status === 'AT_RISK') {
          return (b.daysLate || 0) - (a.daysLate || 0);
        }
        if (a.status === 'ON_TRACK' && b.status === 'ON_TRACK') {
          return (a.slackDays || 0) - (b.slackDays || 0);
        }
        return (new Date(a.dueDate || 0)).getTime() - (new Date(b.dueDate || 0)).getTime();
      }

      if (sort === 'dueDate') {
        return (new Date(a.dueDate || 0)).getTime() - (new Date(b.dueDate || 0)).getTime();
      }
      if (sort === 'daysLate') {
        return (b.daysLate || 0) - (a.daysLate || 0);
      }
      if (sort === 'slackDays') {
        return (a.slackDays || 0) - (b.slackDays || 0);
      }
      if (sort === 'orderNumber') {
        return (a.orderNumber || '').localeCompare(b.orderNumber || '');
      }
      if (sort === 'buyer') {
        return (a.buyer || '').localeCompare(b.buyer || '');
      }
      return 0;
    });

    return res.status(200).json({
      orders: assessments,
      summary,
      generatedAt: now.toISOString(),
      assumptions: {
        factoryTimezone: FACTORY_TIMEZONE,
        nonWorkingWeekdays: NON_WORKING_WEEKDAYS,
        deadlineRule: 'End of due date (23:59:59.999) in factory timezone',
        unitConvention: 'dailyCapacity = quantity per production day in machine capacityUnit',
        ratePrecedence: 'order.productionRatePerDay override -> assignedMachine.dailyCapacity',
        tolerance: TOLERANCE,
        isEstimate: true,
        calculationType: 'deterministic_rule_based',
      },
    });
  } catch (error) {
    next(error);
  }
};

const getOrderRadarAssessment = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber || !ORDER_NUMBER_REGEX.test(orderNumber.trim())) {
      return res.status(400).json({
        error: {
          message: `Invalid order number format '${orderNumber}'. Expected format e.g. 'PO-2026-0001'`,
          code: 'INVALID_ORDER_NUMBER',
        },
      });
    }

    const order = await ProductionOrder.findOne({
      orderNumber: orderNumber.trim().toUpperCase(),
    })
      .populate('assignedMachine')
      .lean();

    if (!order) {
      return res.status(404).json({
        error: {
          message: `Production order '${orderNumber}' not found`,
          code: 'ORDER_NOT_FOUND',
        },
      });
    }

    const now = new Date();

    if (order.status === 'completed') {
      const assessment = evaluateOrderRisk(order, now);
      return res.status(200).json({
        assessment,
        generatedAt: now.toISOString(),
      });
    }

    const orderMachineType = order.assignedMachine?.type || 'loom';
    const [availableMachines, activeSharingOrders, defectRolls] = await Promise.all([
      Machine.find({ type: orderMachineType, status: 'available' }).lean(),
      order.assignedMachine?._id
        ? ProductionOrder.countDocuments({
            assignedMachine: order.assignedMachine._id,
            status: { $in: ['queued', 'in_progress', 'on_hold'] },
          })
        : 0,
      FabricRoll.find({
        order: order._id,
        qualityStatus: { $in: ['REJECT', 'REWORK'] },
      }).lean(),
    ]);

    let rollDefects = null;
    if (defectRolls.length > 0) {
      const totalMetres = defectRolls.reduce((acc, r) => acc + (Number(r.quantityMetres) || 0), 0);
      rollDefects = { count: defectRolls.length, metres: totalMetres };
    }

    const assessment = evaluateOrderRisk(order, now, {
      availableSameTypeMachines: availableMachines,
      sharedActiveOrdersCount: activeSharingOrders,
      rejectReworkRolls: rollDefects,
    });

    return res.status(200).json({
      assessment,
      generatedAt: now.toISOString(),
      assumptions: {
        factoryTimezone: FACTORY_TIMEZONE,
        nonWorkingWeekdays: NON_WORKING_WEEKDAYS,
        deadlineRule: 'End of due date (23:59:59.999) in factory timezone',
        unitConvention: 'dailyCapacity = quantity per production day in machine capacityUnit',
        ratePrecedence: 'order.productionRatePerDay override -> assignedMachine.dailyCapacity',
        tolerance: TOLERANCE,
        isEstimate: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRadarAssessments,
  getOrderRadarAssessment,
};
```
