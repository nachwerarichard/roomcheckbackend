require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000; // Use port from environment variable or default to 3000

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(express.json()); // Parse JSON request bodies

// Simple in-memory data store for demonstration purposes
const checklists = [];

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services or SMTP options
    auth: {
        user: process.env.EMAIL_USER, // Your email address from .env
        pass: process.env.EMAIL_PASS, // Your email app password from .env
    },
});

// POST endpoint to submit the checklist
app.post('/submit-checklist', async (req, res) => {
    const { room, date, items } = req.body;

    if (!room || !date || !items) {
        return res.status(400).json({ message: 'Missing required fields: room, date, or items.' });
    }

    const newChecklistEntry = {
        id: Date.now(), // Simple unique ID
        room,
        date,
        items,
        timestamp: new Date(),
    };

    checklists.push(newChecklistEntry);
    console.log('New checklist entry:', newChecklistEntry);

    // Check for missing items (marked "no")
    const missingItems = Object.entries(items).filter(([, value]) => value === 'no');

    let emailSent = false;
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
        checklist: newChecklistEntry, // Optionally send back the stored entry
    });
});

// Basic GET endpoint to view all checklists (for testing/debugging)
app.get('/checklists', (req, res) => {
    res.status(200).json(checklists);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
