const { calendarEvents, MT5Accounts } = require('../models/Trades');

const addNotes = async (req, res) => {
    try {
        const { date, notes, color, mt5AccountNumber } = req.body;
        const userId = req.user?.id;

        if (!date || !notes || !color || !mt5AccountNumber || !userId) {
            return res.status(400).json({ error: 'Date, notes, color, MT5 account number, and user authentication are required' });
        }

        if (notes.length > 100) {
            return res.status(400).json({ error: 'Notes must be 100 characters or fewer' });
        }

        const mt5Account = await MT5Accounts.findOne({
            where: {
                userId,
                accountNumber: mt5AccountNumber,
            },
        });

        if (!mt5Account) {
            return res.status(403).json({ error: 'Invalid MT5 account number for this user' });
        }

        const existingNotes = await calendarEvents.findOne({
            where: {
                date,
                userId,
                mt5_account_number: mt5AccountNumber
            }
        });

        if (existingNotes) {
            await calendarEvents.update(
                { notes, color },
                { where: { date, userId, mt5_account_number: mt5AccountNumber } }
            );

            res.status(200).json({ message: 'Event updated successfully' });
        } else {
            await calendarEvents.create({
                date,
                notes,
                color,
                userId,
                mt5_account_number: mt5AccountNumber
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
        const { date, mt5AccountNumber } = req.body;
        const userId = req.user?.id;

        if (!date || !mt5AccountNumber || !userId) {
            return res.status(400).json({ error: 'Date, MT5 account number, and user authentication are required' });
        }

        const mt5Account = await MT5Accounts.findOne({
            where: {
                userId,
                accountNumber: mt5AccountNumber,
            },
        });

        if (!mt5Account) {
            return res.status(403).json({ error: 'Invalid MT5 account number for this user' });
        }

        const deletedCount = await calendarEvents.destroy({
            where: {
                date,
                userId,
                mt5_account_number: mt5AccountNumber
            }
        });

        if (deletedCount === 0) {
            return res.status(404).json({ error: 'Event not found for this date, user, and account' });
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
        const { mt5AccountNumber } = req.query;
        const userId = req.user?.id;

        if (!mt5AccountNumber || !userId) {
            return res.status(400).json({ error: 'MT5 account number and user authentication are required' });
        }

        const mt5Account = await MT5Accounts.findOne({
            where: {
                userId,
                accountNumber: mt5AccountNumber,
            },
        });

        if (!mt5Account) {
            return res.status(403).json({ error: 'Invalid MT5 account number for this user' });
        }

        const notes = await calendarEvents.findAll({
            where: {
                userId,
                mt5_account_number: mt5AccountNumber
            },
            attributes: ['date', 'notes', 'color']
        });

        res.status(200).json({
            message: 'Event fetched successfully',
            data: notes
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