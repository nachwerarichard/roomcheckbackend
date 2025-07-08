require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose'); // <--- NEW: Import Mongoose

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(express.json()); // Parse JSON request bodies

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services or SMTP options
    auth: {
        user: process.env.EMAIL_USER, // Your email address from .env
        pass: process.env.EMAIL_PASS, // Your email app password from .env
    },
});

// <--- NEW: MongoDB Connection Setup ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('Error connecting to MongoDB:', err.message);
        // It's a good idea to exit the process if the database connection fails
        // process.exit(1);
    });

// <--- NEW: Define Mongoose Schema and Model for Checklists ---
const checklistSchema = new mongoose.Schema({
    room: { type: String, required: true },
    date: { type: Date, required: true }, // Store date as a Date object
    items: {
        type: Map, // Use Map to store flexible key-value pairs
        of: String, // Value type for the map
        required: true
    },
    timestamp: { type: Date, default: Date.now } // Automatically store creation time
});

const Checklist = mongoose.model('Checklist', checklistSchema);
// --- END NEW MongoDB Setup ---


// POST endpoint to submit the checklist
app.post('/submit-checklist', async (req, res) => {
    const { room, date, items } = req.body;

    if (!room || !date || !items) {
        return res.status(400).json({ message: 'Missing required fields: room, date, or items.' });
    }

    let emailSent = false;
    try {
        // <--- MODIFIED: Create a new Mongoose document and save to MongoDB ---
        const newChecklistEntry = new Checklist({
            room,
            date: new Date(date), // Ensure date is stored as a Date object
            items
        });

        await newChecklistEntry.save(); // Save the document to your MongoDB database
        console.log('New checklist entry stored in DB:', newChecklistEntry);
        // --- END MODIFIED ---

        // Check for missing items (marked "no")
        const missingItems = Object.entries(items).filter(([, value]) => value === 'no');

        if (missingItems.length > 0) {
            const missingItemsList = missingItems.map(([key]) => key.replace(/_/g, ' ')).join(', ');
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER, // Send email to yourself or a designated hotel staff email
                subject: `Urgent: Missing Items in Room ${room} - ${date}`,
                html: `
                    <p>Dear Hotel Staff,</p>
                    <p>The following items were reported missing or not in place for Room <strong>${room}</strong> on <strong>${date}</strong>:</p>
                    <ul>
                        ${missingItems.map(([key, value]) => `<li>${key.replace(/_/g, ' ')}: ${value}</li>`).join('')}
                    </ul>
                    <p>Please attend to this matter promptly.</p>
                    <p>Regards,</p>
                    <p>Hotel Checklist System</p>
                `,
            };

            try {
                await transporter.sendMail(mailOptions);
                console.log('Email sent successfully for missing items.');
                emailSent = true;
            } catch (error) {
                console.error('Error sending email:', error);
                // Even if email fails, the checklist submission can still be successful
            }
        }

        res.status(200).json({
            message: 'Checklist submitted successfully!',
            emailSent: emailSent,
            checklist: newChecklistEntry, // Send back the stored entry from the database
        });

    } catch (err) {
        console.error('Error saving checklist to database or sending email:', err);
        res.status(500).json({ message: 'An error occurred while submitting the checklist.' });
    }
});

// <--- MODIFIED: GET endpoint to view all checklists from the database ---
app.get('/checklists', async (req, res) => {
    try {
        const allChecklists = await Checklist.find().sort({ timestamp: -1 }); // Fetch all and sort by newest first
        res.status(200).json(allChecklists);
    } catch (err) {
        console.error('Error fetching checklists from database:', err);
        res.status(500).json({ message: 'Error fetching checklists from the database.' });
    }
});
// --- END MODIFIED ---

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`MongoDB URI status: ${process.env.MONGO_URI ? 'Configured' : 'NOT CONFIGURED (Check your .env file and Render environment variables!)'}`);
});
