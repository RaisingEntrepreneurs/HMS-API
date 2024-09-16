
/**
 * API Name: Vaidhya API
 * Description: This API handles the updating of pharmacy POS system.
 * Developer: [Sindhu,Vishnudar]
 * Date: [April/06/2023]
 * Reviewer: [Vishnudar,Sindhu]
 * Version: 1.0.0
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer'); // Middleware for handling multipart/form-data, including file uploads
const csv = require('csv-parser'); // Parse CSV files
const fs = require('fs'); // File system module
const app = express();
const port = process.env.PORT ||5000;
const logger = require('./logger'); 
const session = require('express-session');

const cookieParser=require('cookie-parser');
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));

///////////////////////////////////Session Mangemement and cookie ///////////////////
app.use(cookieParser());
app.use(session({
  secret: "secret",
  resave: true,
  saveUninitialized:false,
  cookie:{
    httpOnly : true,
    maxAge: 900000, // 900000 milliseconds = 15 minutes
    sameSite:'none',
    secure:true 
    // sameSite: 'none',
    // secure: true, // Enable this option if your application is served over HTTPS
  }
}))

 let poolConfig;


  try {
    const rawdata = fs.readFileSync('Vaidhya_db.txt');
    
    poolConfig = JSON.parse(rawdata);
  } catch (err) {
    logger.error('Error reading database configuration file:', err);
    process.exit(1);
  }
  
  const pool = new Pool(poolConfig);

//////////////////////////////////Session Managements/////////////////////////

// Middleware to refresh the session if activity is detected
app.use((req, res, next) => {
  req.session.lastActive = Date.now();
  next();
});

// Example route to check session status
app.get('/check-session', (req, res) => {
  if (req.session.lastActive) {
    const lastActive = new Date(req.session.lastActive);
    res.send(`Last active: ${lastActive}`);
  } else {
    res.send('Session not initialized.');
  }
});


// API endpoint to check session validity
app.get('/api/checkSession', async (req, res) => {
  const { sessionID } = req.query;

  try {
    // Query the sessions table to check if the sessionID exists
    const result = await pool.query('SELECT * FROM sessions WHERE session_token = $1', [sessionID]);

    if (result.rowCount === 1) {
      // Session is valid
      res.json({ valid: true });
    } else {
      // Session is invalid
      res.json({ valid: false });
    }
  } catch (error) {
    logger.error('Error checking session validity:', error);
    res.status(500).json({ error: 'An error occurred while checking session validity' });
  }
});

app.post('/api/checkSession', async (req, res) => {
  const { sessionID, userID, username, createdAt } = req.body;

  try {
    // Insert new session into the database
    await pool.query('INSERT INTO sessions (session_token, user_id, username, created_at) VALUES ($1, $2, $3, $4)', [sessionID, userID, username, createdAt]);

    res.status(201).json({ message: 'Session created successfully' });
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({ error: 'An error occurred while creating session' });
  }
});

app.put('/api/checkSession/:sessionID', async (req, res) => {
  const { sessionID } = req.params;
  const { newSessionID, newUserID, newUsername, newCreatedAt, newDropTime } = req.body;

  try {
    // Update session information in the database
    await pool.query('UPDATE sessions SET session_token = $1, user_id = $2, username = $3, created_at = $4, drop_time = $5 WHERE session_token = $6', [newSessionID, newUserID, newUsername, newCreatedAt, newDropTime, sessionID]);

    res.json({ message: 'Session updated successfully' });
  } catch (error) {
    logger.error('Error updating session:', error);
    res.status(500).json({ error: 'An error occurred while updating session' });
  }
});

app.post('/api/logout/:sessionID', async (req, res) => {
  const { sessionID } = req.params;

  try {
    // Update the drop_time for the session in the database
    await pool.query('UPDATE sessions SET drop_time = NOW() WHERE session_token = $1', [sessionID]);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Error updating session dropout time:', error);
    res.status(500).json({ error: 'An error occurred while updating session dropout time' });
  }
});


app.delete('/api/checkSession/:sessionID', async (req, res) => {
  const { sessionID } = req.params;

  try {
    // Delete session from the database
    await pool.query('DELETE FROM sessions WHERE session_token = $1', [sessionID]);

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    logger.error('Error deleting session:', error);
    res.status(500).json({ error: 'An error occurred while deleting session' });
  }
});


// Endpoint to get a specific patient by ID
app.post('/api/patients', async (req, res) => {
  try {
    const { surName, name, phoneNumber, DateOfBirth, Age, gender, address, city, pinCode, state, Allergies } = req.body;
    const creat_tmst = new Date();

    // Convert allergies to an array if it's a string
    let allergiesArray;
    if (typeof Allergies === 'string') {
      allergiesArray = Allergies.split(',').map(item => item.trim());
    } else {
      allergiesArray = Allergies;
    }

    // Insert new patient record into the database
    const newPatient = await pool.query(
      'INSERT INTO "Ph_pat_dtls" (surname, given_name, phonenumber, dateofbirth, age, gender, address, city, pincode, pt_state, createdAt, allergies) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [surName, name, phoneNumber, DateOfBirth, Age, gender, address, city, pinCode, state, creat_tmst, allergiesArray]
    );

    res.json(newPatient.rows[0]); // Send back the newly created patient data
  } catch (error) {
    logger.error('Error adding new patient:', error.message); // Log the complete error
    res.status(500).json({ error: 'Error adding new patient' });
  }
});

app.put('/api/patientsph/:Patient_Id', async (req, res) => {
  try {
    const { Patient_Id } = req.params; // Extract patient ID from request params
    const { surname, given_name, phonenumber, dateofbirth, age, gender, address, city, pincode, pt_state, allergies } = req.body;

    console.log(req.body); // Log the incoming request data for debugging

    // Ensure that the dateofbirth is valid
    // In your backend, before using the date
const dob = new Date(dateofbirth);
if (isNaN(dob.getTime())) {
  return res.status(400).json({ error: 'Invalid Date of Birth' });
}

// If valid, continue with the update query


    // Convert allergies to an array if it's a string
    let allergiesArray;
    if (typeof allergies === 'string') {
      allergiesArray = allergies.split(',').map(item => item.trim()); // Convert comma-separated string to array
    } else {
      allergiesArray = allergies;
    }
    
    // Update patient record in the database
    const updatePatient = await pool.query(
      `UPDATE "Ph_pat_dtls" 
       SET surname = $1, given_name = $2, phonenumber = $3, dateofbirth = $4, age = $5, gender = $6, 
           address = $7, city = $8, pincode = $9, pt_state = $10, allergies = $11
       WHERE "Patient_Id" = $12
       RETURNING *`,
      [surname, given_name, phonenumber, dateOfbirth, age, gender, address, city, pincode, pt_state, allergiesArray, Patient_Id]
    );

    // Check if any patient record was updated
    if (updatePatient.rowCount === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Send back the updated patient data
    res.json(updatePatient.rows[0]);

  } catch (error) {
    console.error('Error updating patient:', error); // Log the complete error
    res.status(500).json({ error: 'Error updating patient' });
  }
});


app.delete('/api/patientsph/:Patient_Id', async (req, res) => {
try {
  const { Patient_Id } = req.params; // Extract patient ID from request params

  // Delete patient record from the database
  const deletePatient = await pool.query(
    `DELETE FROM "Ph_pat_dtls" WHERE "Patient_Id" = $1`,
    [Patient_Id]
  );

  // Check if any patient record was deleted
  if (deletePatient.rowCount === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  res.json({ message: 'Patient deleted successfully' });
} catch (error) {
  logger.error('Error deleting patient:', error.message);
  res.status(500).json({ error: 'Error deleting patient' });
}
});


// Read all patients
app.get('/api/patients', async (req, res) => {
  try {
      const { search } = req.query;
      // Check if search parameter is provided
      if (!search) {
          return res.json([]); // Return empty response if search parameter is not provided
      }

      let query = `
          SELECT * 
          FROM "Ph_pat_dtls" 
          WHERE 
              LOWER("surname") LIKE LOWER($1) OR 
              LOWER("given_name") LIKE LOWER($1) OR 
              LOWER("phonenumber") LIKE LOWER($1)
      `;
      const values = [`%${search}%`];

      const result = await pool.query(query, values);
      res.json(result.rows);
  } catch (err) {
     
      logger.error('Error getting patients:', err.message);

      res.status(500).json({ err: err.message });
  }
});



app.get('/api/patientsdob', async (req, res) => {
try {
  const { search } = req.query;

  // Check if search parameter is provided
  if (!search) {
    return res.json([]); // Return empty response if search parameter is not provided
  }

  // Modify the query to search for records with date of birth starting with the provided partial date
  let query = 'SELECT * FROM "Ph_pat_dtls" WHERE "dateofbirth"::text LIKE $1';
  const values = [search + '%']; // Add wildcard '%' to search for records starting with the provided partial date

  const result = await pool.query(query, values);
  res.json(result.rows);

} catch (err) {

  logger.error('Error searching patients by date of birth:', err.message);

  res.status(500).json({ error: 'Failed to search patients by date of birth' });
}
});



// Read a patient by ID
app.get('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await pool.query('SELECT * FROM "Ph_pat_dtls" WHERE "patient_nme" = $1', [id]);
    res.json(patient.rows[0]);
  } catch (err) {
    logger.error('Error getting patient:', err.message);

    res.status(500).json({ err: err.message  });
  }
});

// Update a patient
app.put('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { patient_nme, age, gender, address1, address2, city, state, zip_code } = req.body;

    const updatedPatient = await pool.query(
      'UPDATE "Ph_pat_dtls" SET "Patient_Nme" = $1, "Age" = $2, "Gender" = $3, "Address1" = $4, "Address2" = $5, "City" = $6, "State" = $7, "Zip_code" = $8 WHERE "Patient_Id" = $9 RETURNING *',
      [patient_nme, age, gender, address1, address2, city, state, zip_code, id]
    );

    res.json(updatedPatient.rows[0]);
  } catch (err) {
  
    logger.error('Error updating patient:', err.message);

    res.status(500).json({ err: err.message  });
  }
});

// Delete a patient
app.delete('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM "Ph_pat_dtls" WHERE "patient_nme" = $1', [id]);
    res.json({ message: 'Patient deleted successfully' });
  } catch (err) {
    logger.error('Error deleting patient:', err.message);

    res.status(500).json({ error: err.message  });
  }
});

/////////////////////user's/////////////////////////
// Assuming Express.js as your backend framework

app.post('/users', async (req, res) => {
  const { username, password, userType } = req.body;
  
  // Check if username already exists
  const existingUser = await db.query('SELECT * FROM users WHERE usrnme = $1', [username]);
  
  if (existingUser.rows.length > 0) {
    return res.status(400).json({ error: 'User already exists' });
  }

  // If username doesn't exist, create a new user
  const hashedPassword = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO users (usrnme, pswd, typ) VALUES ($1, $2, $3)', [username, hashedPassword, userType]);
  
  res.status(201).json({ message: 'User created successfully' });
});
// API to create a new appointment
app.post('/api/appointments', async (req, res) => {
  const { doctorName, patientName, reason, date, start, end_time } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO appointments (doctor_name, patient_name, reason,date, start, end) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [doctorName, patientName, reason,date, start, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/api/pastAppointments/:patientId', async (req, res) => {
  const { patientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, date, time, reason, suggestions, prescription
       FROM appointments
       WHERE patient_id = $1 AND date < CURRENT_DATE
       ORDER BY date DESC`,
      [patientId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching past appointments:', err);
    res.status(500).json({ error: 'Error fetching past appointments' });
  }
});
app.get('/api/upcomingAppointments/:patientId', async (req, res) => {
  const { patientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, date, time, doctor
       FROM appointments
       WHERE patient_id = $1 AND date >= CURRENT_DATE
       ORDER BY date ASC`,
      [patientId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching upcoming appointments:', err);
    res.status(500).json({ error: 'Error fetching upcoming appointments' });
  }
});
app.get('/api/appointments/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, date, time, reason, symptoms, investigation, prescription, diagnosis_expected, diagnosis_actual
       FROM appointments
       WHERE id = $1`,
      [appointmentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching appointment details:', err);
    res.status(500).json({ error: 'Error fetching appointment details' });
  }
});
app.put('/api/appointments/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;
  const { reason, symptoms, investigation, prescription, diagnosisExpected, diagnosisActual } = req.body;

  try {
    const result = await pool.query(
      `UPDATE appointments 
       SET reason = $1, symptoms = $2, investigation = $3, prescription = $4, 
           diagnosis_expected = $5, diagnosis_actual = $6
       WHERE id = $7
       RETURNING *`,
      [reason, symptoms, investigation, prescription, diagnosisExpected, diagnosisActual, appointmentId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ error: 'Error updating appointment' });
  }
});

// API to delete an appointment by ID
app.delete('/api/appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;

  try {
    await pool.query('DELETE FROM appointments WHERE id = $1', [appointmentId]);
    res.status(200).json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// API to update an appointment by ID
app.put('/api/appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;
  const { doctorName, patientName, reason, date, start, end_time } = req.body;

  try {
    const result = await pool.query(
      'UPDATE appointments SET doctor_name = $1, patient_name = $2, reason = $3,date = $4, start = $5, end = $6 WHERE id = $7 RETURNING *',
      [doctorName, patientName, reason, start, date, end_time, appointmentId]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//////////////////////////////////////to-do///////////////////////////
// Assuming you've set up a pool using the pg library
app.post('/api/tasks', async (req, res) => {
  const { title, assignedTo, status, message } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, assigned_to, status, message, date_assigned) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [title, assignedTo, status, message]
    );
    res.status(201).json(result.rows[0]); // Return the created task
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
});



app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks');
    res.json(result.rows); // Return the list of tasks
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
      [status, taskId]
    );

    if (result.rowCount === 0) {
      return res.status(404).send('Task not found');
    }

    res.json(result.rows[0]); // Return the updated task
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});
app.delete('/api/tasks/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);

  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [taskId]);

    if (result.rowCount === 0) {
      return res.status(404).send('Task not found');
    }

    res.json({ message: 'Task deleted successfully', task: result.rows[0] });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});
/////////////////nurse////////////////////
// GET /api/tasks/nurse/:nurseId - Fetch tasks assigned to a specific nurse
app.get('/api/tasks/nurse/:nurseId', async (req, res) => {
  const nurseId = req.params.nurseId;

  try {
    const result = await pool.query('SELECT * FROM tasks WHERE assigned_to = $1', [nurseId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No tasks assigned to this nurse' });
    }

    res.json(result.rows); // Return the tasks assigned to the nurse
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks for the nurse' });
  }
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Start the server
app.listen(port, function () {
  console.log(`The SERVER HAS STARTED ON PORT: ${port}`);
})
//   Fix the Error EADDRINUSE
.on("error", function (err) {
  process.once("SIGUSR2", function () {
    process.kill(process.pid, "SIGUSR2");
  });
  process.on("SIGINT", function () {
    // this is only called on ctrl+c, not restart
    process.kill(process.pid, "SIGINT");
  });
});