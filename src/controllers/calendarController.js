const { calendarEvents, Accounts } = require('../models/Trades');

const addNotes = async (req, res) => {
    try {
        const { date, notes, color, accountNumber } = req.body;
        const userId = req.user?.id;

        if (!date || !notes || !color || !accountNumber || !userId) {
            return res.status(400).json({ error: 'Date, notes, color, account number, and user authentication are required' });
        }

        if (notes.length > 100) {
            return res.status(400).json({ error: 'Notes must be 100 characters or fewer' });
        }

        const Account = await Accounts.findOne({
            where: {
                userId,
                accountNumber: accountNumber,
            },
        });

        if (!Account) {
            return res.status(403).json({ error: 'Invalid Account number for this user' });
        }

        const existingNotes = await calendarEvents.findOne({
            where: {
                date,
                userId,
                accountNumber: accountNumber
            }
        });

        if (existingNotes) {
            await calendarEvents.update(
                { notes, color },
                { where: { date, userId, accountNumber: accountNumber } }
            );

            res.status(200).json({ message: 'Event updated successfully' });
        } else {
            await calendarEvents.create({
                date,
                notes,
                color,
                userId,
                accountNumber: accountNumber
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
        const { date, accountNumber } = req.body;
        const userId = req.user?.id;

        if (!date || !accountNumber || !userId) {
            return res.status(400).json({ error: 'Date, account number, and user authentication are required' });
        }

        const Account = await Accounts.findOne({
            where: {
                userId,
                accountNumber: accountNumber,
            },
        });

        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }

        const deletedCount = await calendarEvents.destroy({
            where: {
                date,
                userId,
                accountNumber: accountNumber
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
        const { accountNumber } = req.query;
        const userId = req.user?.id;

        if (!accountNumber || !userId) {
            return res.status(400).json({ error: 'Account number and user authentication are required' });
        }

        const Account = await Accounts.findOne({
            where: {
                userId,
                accountNumber: accountNumber,
            },
        });

        if (!Account) {
            return res.status(403).json({ error: 'Invalid account number for this user' });
        }

        const notes = await calendarEvents.findAll({
            where: {
                userId,
                accountNumber: accountNumber
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