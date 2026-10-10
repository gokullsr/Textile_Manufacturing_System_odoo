const { Machine, ProductionOrder } = require('../models');

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
