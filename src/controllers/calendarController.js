const { calendarEvents, Trades } = require('../models/Trades');

const addNotes = async (req, res) => {
    try {
        const { date, notes, color } = req.body;
        if (!date || !notes || !color) {
            return res.status(400).json({ error: 'Date, notes, and color are required' });
        }
        const existingNotes = await calendarEvents.findOne({
            where: {
                date: date
            }
        });

        if (existingNotes) {
            await calendarEvents.update(
                { notes, color },
                { where: { date } }
            );

            res.status(200).json({ message: 'Event updated successfully' });
        } else {
            await calendarEvents.create({
                date: date,
                notes: notes,
                color: color
            });

            res.status(200).json({ message: 'Event added successfully' });
        }
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                error: 'Server error',
                details: err.errors.map(e => e.message),
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            details: err.message,
        });
    }
};

const deleteNotes = async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const deletedCount = await calendarEvents.destroy({
            where: {
                date: date
            }
        });

        if (deletedCount === 0) {
            return res.status(404).json({ error: 'Event not found for this date' });
        }

        res.status(200).json({
            message: 'Event deleted successfully',
            deletedRecords: deletedCount
        });
    } catch (err) {
        res.status(500).json({
            error: 'Internal server error',
            details: err.message,
        });
    }
};

const getNotes = async (req, res) => {
    try {
        const notes = await calendarEvents.findAll({
            attributes: ['date', 'notes', 'color']
        });

        res.status(200).json({
            message: 'Event fetched successfully',
            data: notes, // Corrected here: it should be `notes`, not `Trades`.
        });
    } catch (err) {
        console.log(err, "err");
        res.status(500).json({
            error: 'Internal server error',
            details: err.message,
        });
    }
};

module.exports = {
    addNotes,
    deleteNotes,
    getNotes
};
