import express from 'express';
import diagnoseRouter from './routes/diagnoses'
import patientRouter from './routes/patients'
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());
app.use('/api/diagnosis',diagnoseRouter);
app.use('/api/patients',patientRouter)
const PORT = 3001;

app.get('/api/ping', (_req, res) => {
  console.log('someone pinged here');
  res.send('pong');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});