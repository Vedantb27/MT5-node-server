const { calendarEvents, Trades } = require('../models/Trades');

const addNotes = async (req, res) => {
    try {
        const { date, notes } = req.body;
        if (!date || !notes) {
            return res.status(400).json(error, 'Date and notes are required');
        }
        const existingNotes = await calendarEvents.findOne({
            where: {
                date: date
            }
        });

        if (existingNotes) {
            await calendarEvents.update(
                { notes },
                { where: { date } }
            );

            res.status(200).json({message:'notes created successfully'});
        }
        else {
            await calendarEvents.create({
                date: date,
                notes: notes
            });

            res.status(200).json({ message: 'Notes added successfully' });
        }

        
    }
    catch (err) {
        if (err.name == 'SequelizeUniqueConstraintError') {
            return res.status(409).json(
                {
                    error: 'Notes already added for this date',
                    details: err.errors.map(e => e.message),

                });
        }
    }
}

const deleteNotes = async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) {
            return res.staus(4000).json({ eror: 'Date is required' });
        }

        const deletedCuunt = await calendarEvents.destroy({
            where: {
                date: date
            }
        })

        if (deletedCuunt === 0) {
            return res.status(404).json({ error: 'Notes not found for this date' })
        }

        res.status(200).json({
            message: 'Notes deleted successfully',
            deletedRecords: deletedCount
        });
    }
    catch (err) {
        if (err.name == '')
            res.status(500).json({
                error: 'Internal server error',
                details: err.errors.map(e => e.message),
            });
    }
}

const getNotes = async (req, res) => {
    console.log('fetching notes from database')
    try {
        const notes = await calendarEvents.findAll({
            attributes: ['date', 'notes']
        });

        //console.log('notes',notes);
        console.log('notes in json', json(notes));

        if (!notes.length) {
            return res.status(400).json({ error: 'no notes found' });
        }

        res.status(200).json({
            message: 'notes fetched successfully',
            data: json(Trades),
        });
    }
    catch (err) {
        res.status(500).json({
            err: 'Internal server error',
            details: err
        })
    }
}

module.exports = {
    addNotes,
    deleteNotes,
    getNotes
}