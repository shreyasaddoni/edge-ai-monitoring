# EDGE AI BASED EPILEPSY PATIENT MONITORING SYSTEM

**Clinical Seizure Surveillance & Telemetry Platform**  
**Autonomous Edge Machine Learning & Automated Caretaker Notification**

---

## 1. Project Overview & Workflow

The **Edge AI Based Epilepsy Patient Monitoring System** is an end-to-end full-stack medical technology application designed to bridge the gap between hospital-confined EEG diagnosis and real-time remote continuous patient surveillance.

Epileptic seizures are unpredictable, and patients often experience episodes outside clinical environments. This system demonstrates how edge signal processing, localized Machine Learning, and cloud database telemetry can continuously monitor EEG signals, detect abnormal epileptiform patterns, estimate seizure risk, update an attending doctor dashboard, and automatically dispatch SMS alerts to a registered caretaker.

### End-to-End Operational Pipeline
```
[CHB-MIT EEG / Telemetry Simulator]
             │ (2.0s streaming batches @ 256 Hz)
             ▼
[Edge Preprocessing Pipeline]
  ├─ SciPy Butterworth Bandpass (0.5 – 45.0 Hz)
  ├─ IIR Notch Filter (50.0 Hz powerline hum removal)
  └─ Artifact & NaN/Inf Signal Quality Check
             │
             ▼
[Feature Extraction Module]
  ├─ Time-Domain: Mean, Std Dev, RMS Amplitude, Kurtosis, Line Length
  └─ Frequency-Domain: Delta (0.5-4Hz), Theta (4-8Hz), Alpha (8-12Hz), Beta (12-30Hz), Slowing Ratio
             │
             ▼
[Random Forest Classifier (100 Trees)]
  ├─ Local Scikit-learn inference (Zero-Cost, no paid external APIs)
  └─ Probability & Risk Tier Mapping (<40% Low, 40-70% Medium, ≥70% High)
             │
             ▼
[Alert Service & Cooldown Engine]
  ├─ Deduplication (90s cooldown to prevent notification storms)
  ├─ Caretaker SMS Consent Verification
  └─ E.164 Phone Format Validation (Google phonenumbers library)
             │
       ┌─────┴────────────────────────┐
       ▼                              ▼
[Twilio SMS Gateway]       [Cloud Firestore / Local Store]
  ├─ Automated Caretaker SMS    ├─ Patient roster & caretaker contacts
  └─ Delivery Webhook Callback  ├─ Historical predictions & biometric trends
                                └─ Physician acknowledgement audit trail
             │
             ▼
[Doctor Monitoring Dashboard (React + Vite + Recharts)]
  ├─ Oscilloscope EEG Waveform Visualizer
  ├─ Real-Time Biometric Metric Matrix
  ├─ Cohort Risk Distribution Donut & Area Trend Charts
  └─ CSV Compliance Report Exporter
```

---

## 2. Technology Stack

- **Frontend:**
  - React.js with Vite 6
  - Tailwind CSS
  - React Router DOM v7
  - Recharts for analytics and real-time EEG waveform oscilloscope
  - Lucide React for modern healthcare icons
  - Axios for authenticated REST communication
- **Backend:**
  - Python 3
  - Flask with Flask-CORS
  - RESTful architecture with modular Blueprints
  - Firebase Admin SDK
- **Machine Learning & Signal Processing:**
  - Scikit-learn (Random Forest Classifier, balanced class weighting)
  - SciPy (`signal.butter`, `signal.filtfilt`, `signal.iirnotch`, `signal.welch`)
  - NumPy & Pandas
  - Joblib for model serialization
- **Database & Identity:**
  - Firebase Cloud Firestore (NoSQL document store)
  - Firebase Authentication (Email/Password)
  - Firestore Security Rules & Composite Indexes
  - Zero-Cost Local SQLite Fallback Engine for offline development
- **Emergency Notifications:**
  - Official Twilio Python SDK
  - Google `phonenumbers` library for strict international E.164 phone validation
  - In-app simulated notifications fallback when Twilio is not configured

---

## 3. Strict Zero-Cost Development Guarantee

This application was engineered to be **100% functional with zero financial cost**:
1. **No Paid AI APIs:** Uses local Scikit-learn execution. No OpenAI, Gemini, or external paid tokens required.
2. **Free Database Tier:** Operates within Firebase Spark's perpetual no-cost quota. If Firebase credentials are not supplied, the built-in local SQLite emulator seamlessly mirrors Firestore collections.
3. **Optional Twilio SMS:** Operates in zero-cost in-app simulation mode when Twilio credentials are unset, ensuring evaluators can test the complete notification lifecycle without purchasing Twilio credits.
4. **Local Hardware Execution:** All filtering, feature extraction, and ML model predictions run entirely on your local CPU.

---

## 4. Quick Start (Running Locally)

### Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+)

### Step 1: Clone and Set Up Virtual Environment
```bash
# In the project root:
python -m venv venv

# Activate venv:
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install Python backend dependencies:
pip install -r backend/requirements.txt
```

### Step 2: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### Step 3: Calibrate / Verify the Machine Learning Model
```bash
# Train the Random Forest Seizure Detection model locally:
python -m backend.ml.train_model
```
*Output: Saves calibrated model to `backend/ml/saved_models/random_forest_seizure_detector.joblib` with evaluation metrics.*

### Step 4: Run Automated Tests
```bash
python -m pytest backend/tests/test_backend.py -v
```
*Verifies preprocessing filters, feature extraction, E.164 phone validation, ML inference, alert cooldown, and API routes.*

### Step 5: Start Development Servers
Open two terminal windows:

**Terminal 1 (Backend Server):**
```bash
# Ensure venv is active
python -m backend.app
# Runs on http://127.0.0.1:5000
```

**Terminal 2 (Frontend React App):**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

Open your browser at `http://localhost:5173`!

---

## 5. Demonstration Workflow (Step-by-Step for Evaluation)

1. **Sign In:**
   - On the login screen, click **"Sign In as Doctor"** for instant evaluation.
2. **Register a Patient & Caretaker:**
   - Navigate to **"Patient Management"** &rarr; click **"Register Patient"**.
   - Fill in patient details (e.g., Name: `Devika Nair`, Age: `24`).
   - Fill in mandatory caretaker fields:
     - Caretaker Name: `Sunil Nair`
     - Caretaker Mobile: `+919876543210` (must be valid E.164 format)
     - Relationship: `Father`
     - Check **"SMS Consent Confirmation"** &rarr; click **"Complete Registration"**.
3. **Live Wearable Telemetry & Seizure Detection:**
   - Navigate to **"Live EEG Monitoring"**.
   - Select your patient from the dropdown.
   - Select stream:
     - `Baseline Normal Alpha EEG` &rarr; click **"Start Telemetry"**. Observe normal waves (20-40 µV) and **Low Risk (<40%)**.
     - Switch recording to `Epileptic Seizure Discharge (Ictal 3Hz Spike-and-Wave)` &rarr; click **"Start Telemetry"**.
     - Observe high-amplitude spike waves (200 µV), increased slowing ratio, and **High Risk (≥70%)**.
     - A **High-Risk Emergency Alert Banner** appears with SMS status!
4. **EEG Dataset Upload & Continuous Playback Simulator (Mandatory Feature):**
   - Navigate to **"EEG Upload & Simulator"** (`/upload`).
   - Upload any CHB-MIT Scalp EEG `.edf`, `.csv`, or `.tsv` recording file, or click **"Generate Benchmark EDF"** to create a verified CHB-MIT standard EDF file on demand.
   - Inspect the extracted recording metadata (Sampling rate, Channels, Duration, Total Samples, Annotations).
   - Associate the recording with an authorized patient and select the target EEG channel.
   - Click **"Initialize Playback Session"** and then **"Start Playback"**.
   - Watch the sequential packet stream:
     - Packets arrive every second (256 samples).
     - Rolling buffer accumulates to the required 2.0s analysis window (512 samples) before running Random Forest inference.
     - Live oscilloscope plots the exact microvolt samples from the uploaded recording.
     - Risk gauge updates in real time.
     - Playback controls allow Pause, Resume without jumping, Stop, Restart from index 0, and Speed selection (1x, 2x, 4x, 8x).
     - When high-risk epileptiform activity is detected, eligible caretaker alerts are dispatched subject to consent and 90s cooldown deduplication.
5. **Alerts & SMS Review:**
   - Navigate to **"Alerts & Twilio SMS"**.
   - Review the newly generated high-risk alert.
   - Click **"Acknowledge"** to record physician sign-off.
6. **Analytics & Reports:**
   - Navigate to **"Reports & Analytics"** to inspect the epoch history table.
   - Click **"Export Summary (CSV)"** to download the analysis spreadsheet.
7. **Settings & Retraining:**
   - Navigate to **"System Settings"** to test the manual test SMS dialog or click **"Retrain & Calibrate Model Locally"**.

---

## 6. EEG Dataset Upload & Continuous Playback Simulator Architecture

```
[Uploaded CHB-MIT .edf / .csv / .tsv File]
             │
             ▼
[EEGFileReader (MNE-Python & SciPy)]
  ├─ Validates magic header, sampling frequency, channel names, duration
  ├─ Stores raw recording on server disk (`backend/uploads/eeg/`) with sanitized UUIDs
  └─ Writes metadata ONLY to database (Zero raw EEG samples in Firestore)
             │
             ▼
[ContinuousPlaybackSession]
  ├─ Configurable packet size (e.g. 1.0s = 256 samples @ 256 Hz)
  ├─ Ordered sequential slicing (Tracks current_sample_index & packet_sequence)
  ├─ Never repeats full file as single packet; no synthetic replacement samples
  └─ Rolling Analysis Buffer:
       ├─ Accumulates packets until model window threshold is satisfied (512 samples)
       ├─ Status: "Accumulating Buffer" -> "Analysis Window Evaluated"
       └─ Sliding window FIFO with bounded memory management
             │
             ▼
[Random Forest ML Inference]
  ├─ Feature extraction on 512-sample window (13 spectral & temporal features)
  ├─ Seizure probability & Risk Tier classification (Low, Medium, High)
  └─ Stores prediction in database
             │
             ▼
[Real-Time Waveform & Dashboard Telemetry]
  ├─ Downsampled smooth 60fps oscilloscope with real recorded microvolts
  ├─ Progress bar, elapsed simulated time vs recording duration
  └─ Controls: Start, Pause, Resume, Stop, Restart, 1x/2x/4x/8x Speed
             │
             ▼
[Caretaker Alert Verification]
  ├─ High-risk evaluation
  ├─ Consent validation (+E.164 phone validation)
  └─ 90-second deduplication cooldown (Prevents SMS storms during sustained episodes)
```

### Safety & Simulation Boundaries
- **Labeling:** The system explicitly labels this feature as **Simulated Wearable Acquisition using Recorded EEG Data** across all UI banners and documentation.
- **Hardware Abstraction:** It models real-time serial hardware packet arrival without requiring physical wearable patch devices.
- **Clinical Boundary:** Predictions are for educational demonstration and are not certified diagnostic conclusions.

---

## 7. CHB-MIT Scalp EEG Dataset Setup Guide

This project is built around the **CHB-MIT Scalp EEG Database** from PhysioNet.

1. **Dataset Source:**
   - Available at PhysioNet: https://physionet.org/content/chbmit/1.0.0/
   - Contains 664 EEG recordings across 23 pediatric subjects with 198 annotated epileptic seizures.
2. **Directory Configuration:**
   - To use physical `.edf` recordings, create a folder `backend/data/chbmit/` and place `.edf` files and `.summary.txt` annotation files inside it.
   - Configure path in `.env`: `EEG_DATASET_PATH=backend/data/chbmit`
3. **Sampling Rate & Montage:**
   - Sampling rate: `256 Hz`, 16-bit resolution.
   - Standard 10-20 international system bipolar channels (e.g. `FP1-F7`, `F7-T7`, `T7-P7`, `P7-O1`).
4. **Zero-Cost Built-In Mode:**
   - If physical 40GB+ PhysioNet files are not downloaded, the system includes calibrated biological signal streams that model normal rhythms, interictal sharp transients, and ictal spike discharges mathematically for zero-barrier demonstration.

---

## 8. Firebase Cloud Firestore Setup Guide

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project on the **Spark (no-cost) Plan**.
2. Enable **Authentication** &rarr; Sign-in method &rarr; **Email/Password**.
3. Create a **Cloud Firestore Database** in your preferred region.
4. Go to **Project Settings &rarr; Service Accounts &rarr; Generate New Private Key** (download JSON).
5. Set environment variable:
   ```env
   FIREBASE_PROJECT_ID=your_project_id
   GOOGLE_APPLICATION_CREDENTIALS=backend/serviceAccountKey.json
   ```
6. Deploy security rules and indexes using Firebase CLI:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

---

## 9. Twilio SMS Setup Guide

1. Create a free trial account at [Twilio](https://www.twilio.com/).
2. Obtain your **Account SID**, **Auth Token**, and an assigned **Twilio Phone Number**.
3. In backend `.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
   ```
4. Verify destination phone numbers in Twilio console (trial restriction).
5. For status callbacks, set `TWILIO_STATUS_CALLBACK_URL` to your public webhook endpoint (or use ngrok during development: `ngrok http 5000` &rarr; `https://xxxx.ngrok-free.app/api/alerts/twilio-callback`).
6. *Note:* If Twilio credentials are not set, the app continues seamlessly in zero-cost in-app simulation mode.

---

## 10. Academic & Clinical Disclaimer

> **IMPORTANT DISCLAIMER:**  
> This software is an **experimental academic prototype** developed for engineering degree requirements. It is **not** a certified medical device and must **not** be used as a primary diagnostic tool or for clinical emergency life-support decisions without professional medical supervision.
