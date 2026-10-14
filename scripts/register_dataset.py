import os
from pathlib import Path
from datetime import datetime, timezone
import mne
from backend.firebase.firebase_client import db_client
from backend.config import Config

dataset_dir = Path('Dataset')
edf_files = sorted(list(dataset_dir.glob('*.edf')))
print(f'Found {len(edf_files)} EDF files in Dataset directory.')

# Seizure metadata based on official PhysioNet CHB-MIT annotation files
seizure_map = {
    'chb01_03.edf': {'hasSeizure': True, 'onsetSec': 2996, 'endSec': 3036, 'scenario': 'Ictal Seizure Event (Onset at 2996s)'},
    'chb01_04.edf': {'hasSeizure': True, 'onsetSec': 1467, 'endSec': 1494, 'scenario': 'Ictal Seizure Event (Onset at 1467s)'},
    'chb01_15.edf': {'hasSeizure': True, 'onsetSec': 1732, 'endSec': 1772, 'scenario': 'Ictal Seizure Event (Onset at 1732s)'},
    'chb01_16.edf': {'hasSeizure': True, 'onsetSec': 1015, 'endSec': 1066, 'scenario': 'Ictal Seizure Event (Onset at 1015s)'},
    'chb01_18.edf': {'hasSeizure': True, 'onsetSec': 1720, 'endSec': 1810, 'scenario': 'Ictal Seizure Event (Onset at 1720s)'},
}

now_iso = datetime.now(timezone.utc).isoformat()

for f in edf_files:
    fname = f.name
    clean_stem = fname.replace('.edf', '')
    rec_id = f'rec_{clean_stem}'
    seizure_info = seizure_map.get(fname, {'hasSeizure': False, 'scenario': 'Interictal Baseline Rhythm (Non-Seizure)'})
    
    # Read header only without preloading large 42MB signal
    raw = mne.io.read_raw_edf(str(f), preload=False, verbose='ERROR')
    sfreq = int(round(float(raw.info['sfreq'])))
    ch_names = [str(ch).replace('EEG ', '').replace('-REF', '').strip() for ch in raw.ch_names]
    n_samples = int(raw.n_times)
    duration_sec = float(round(float(n_samples / sfreq), 2))
    
    doc = {
        'recordingId': rec_id,
        'patientId': 'PAT-CHB01',
        'patientName': 'Aarav Sharma',
        'originalFilename': fname,
        'storedFilename': fname,
        'localFilePath': str(f.resolve()),
        'format': 'EDF',
        'fileSizeBytes': int(f.stat().st_size),
        'samplingFrequency': int(sfreq),
        'durationSec': float(duration_sec),
        'totalSamples': int(n_samples),
        'channels': ch_names,
        'recommendedChannel': 'FP1-F7',
        'clinicalScenario': seizure_info['scenario'],
        'hasSeizure': bool(seizure_info.get('hasSeizure', False)),
        'seizureOnsetSec': int(seizure_info['onsetSec']) if seizure_info.get('onsetSec') is not None else None,
        'seizureEndSec': int(seizure_info['endSec']) if seizure_info.get('endSec') is not None else None,
        'startOffsetSec': int(max(0, seizure_info['onsetSec'] - 10)) if seizure_info.get('hasSeizure') else 0,
        'description': f'CHB-MIT Subject 01 {fname} - {seizure_info["scenario"]}',
        'expectedOutcome': 'High Seizure Risk (Spike-Wave Discharges)' if seizure_info.get('hasSeizure') else 'Normal Baseline Rhythm',
        'createdAt': now_iso,
        'updatedAt': now_iso
    }
    
    db_client.set_document('eeg_recordings', rec_id, doc)
    print(f'Registered {rec_id} ({fname}) in Firestore: {doc["clinicalScenario"]}')

print(f'All {len(edf_files)} authentic dataset files registered into Firestore successfully!')
