/**
 * Machine Controller.
 * Manages factory machine queries and operational state inspection.
 */
const { Machine, ProductionOrder } = require('../models');

/**
 * GET /api/machines
 * Returns all factory machines with their current assigned production orders and state breakdown.
 */
const getMachines = async (req, res, next) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const machines = await Machine.find(filter)
      .populate('currentAssignedOrder')
      .sort('code')
      .lean();

    // Map machines to consistent presentation format
    const formattedMachines = machines.map((machine) => {
      const assignedOrder = machine.currentAssignedOrder;
      return {
        _id: machine._id,
        code: machine.code,
        name: machine.name,
        type: machine.type,
        status: machine.status,
        capacity: machine.capacity,
        capacityUnit: machine.capacityUnit,
        currentOrder: assignedOrder
          ? {
              orderNumber: assignedOrder.orderNumber,
              buyer: assignedOrder.customer,
              fabricType: assignedOrder.fabricType,
              status: assignedOrder.status,
              dueDate: assignedOrder.dueDate,
            }
          : null,
      };
    });

    return res.status(200).json({
      machines: formattedMachines,
      total: formattedMachines.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMachines,
};
