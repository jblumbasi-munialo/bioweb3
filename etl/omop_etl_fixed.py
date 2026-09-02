import pandas as pd
import logging
import uuid
from datetime import datetime
import os

# --- SQLAlchemy imports for database interaction ---
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

# --- 1. Configuration ---
# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# OMOP CDM Version (for metadata)
OMOP_CDM_VERSION = "5.3.1"

# --- Database Configuration (for PostgreSQL) ---
# IMPORTANT: In a production environment, these should be loaded from environment variables
# or a secure configuration management system, NOT hardcoded.
DB_CONFIG = {
    "DB_TYPE": "postgresql",
    "DB_CONNECTOR": "psycopg2", 
    "DB_USER": os.getenv("OMOP_DB_USER", "omop_user"), 
    "DB_PASSWORD": os.getenv("OMOP_DB_PASSWORD", "omop_password"),
    "DB_HOST": os.getenv("OMOP_DB_HOST", "localhost"),
    "DB_PORT": os.getenv("OMOP_DB_PORT", "5432"),
    "DB_NAME": os.getenv("OMOP_DB_NAME", "omop_cdm")
}

# Construct the connection string using f-strings
DATABASE_URL = (
    f"{DB_CONFIG['DB_TYPE']}+{DB_CONFIG['DB_CONNECTOR']}://"\
    f"{DB_CONFIG['DB_USER']}:{DB_CONFIG['DB_PASSWORD']}@"\
    f"{DB_CONFIG['DB_HOST']}:{DB_CONFIG['DB_PORT']}/{DB_CONFIG['DB_NAME']}"
)

# --- Database Engine Helper ---
def get_db_engine():
    """
    Creates and returns a SQLAlchemy engine for the PostgreSQL database.
    Includes connection testing.
    """
    logging.info("Attempting to create database engine and connect...")
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        # Attempt to connect to verify credentials and DB availability
        with engine.connect() as connection:
            connection.execute(text("SELECT 1")) # Simple query to test connection
        logging.info("Successfully connected to the database.")
        return engine
    except SQLAlchemyError as e:
        logging.critical(f"Failed to connect to the database: {e}")
        return None

# --- 2. Data Extraction (Simulated) ---
def extract_source_data(filepath='data/raw_patients.csv'):
    """
    Simulates extracting raw patient data from a CSV file.
    In a real scenario, this would connect to a database, API, etc.
    
    Args:
        filepath (str): Path to the simulated raw data file.
        
    Returns:
        pd.DataFrame: A DataFrame containing the raw patient data.
                      Returns None if extraction fails.
    """
    logging.info(f"Attempting to extract data from {filepath}...")
    try:
        # Simulate creating a raw data file if it doesn\'t exist for demonstration
        try:
            raw_data = pd.read_csv(filepath)
            if raw_data.empty:
                logging.warning(f"Extracted file {filepath} is empty.")
        except FileNotFoundError:
            logging.warning(f"Raw data file {filepath} not found. Generating dummy data.\n"
                            "    Please consider creating a 'data' directory and 'raw_patients.csv' for real data.")
            dummy_data = {
                'patient_id': [101, 102, 103, 104, 105],
                'gender': ['M', 'F', 'M', 'F', 'O'],
                'birth_date': ['1980-05-15', '1992-11-20', '1975-01-01', '2000-03-10', '1968-07-22'],
                'race_desc': ['White', 'Black', 'Asian', 'White', 'Unknown'],
                'ethnicity_desc': ['Non-Hispanic', 'Hispanic', 'Non-Hispanic', 'Non-Hispanic', 'Unknown']
            }
            raw_data = pd.DataFrame(dummy_data)
            # Optionally save for future runs
            # raw_data.to_csv(filepath, index=False)
            logging.info("Dummy raw data generated successfully.")
            
        logging.info(f"Successfully extracted {len(raw_data)} records.")
        return raw_data
    except Exception as e:
        logging.error(f"Error during data extraction: {e}")
        return None

# --- 3. Data Transformation ---
def transform_to_omop_person(raw_df):
    """
    Transforms raw patient data into the OMOP PERSON table format.
    Includes data validation and error handling.
    
    Args:
        raw_df (pd.DataFrame): DataFrame with raw patient data.
        
    Returns:
        pd.DataFrame: A DataFrame formatted for the OMOP PERSON table.
                      Returns None if transformation fails critically.
    """
    logging.info("Starting transformation to OMOP PERSON table...")
    if raw_df is None or raw_df.empty:
        logging.error("No data to transform for OMOP PERSON.")
        return None

    # Initialize OMOP PERSON DataFrame
    omop_person_df = pd.DataFrame(columns=[
        'person_id', 'gender_concept_id', 'year_of_birth', 'month_of_birth',
        'day_of_birth', 'birth_datetime', 'race_concept_id', 'ethnicity_concept_id',
        'location_id', 'provider_id', 'care_site_id', 'person_source_value',
        'gender_source_value', 'gender_source_concept_id', 'race_source_value',
        'race_source_concept_id', 'ethnicity_source_value', 'ethnicity_source_concept_id'
    ])

    # --- Mapping Dictionaries (OMOP Standard Concepts - simplified for demo) ---
    # In a real scenario, these would come from a concept vocabulary (e.g., Athena)
    GENDER_MAP = {
        'M': 8507,  # Male
        'F': 8532,  # Female
        'O': 8521,  # Other
        'UNKNOWN': 8521 # Other / Unknown
    }
    RACE_MAP = {
        'White': 8527,
        'Black': 8516,
        'Asian': 8515,
        'Unknown': 8522, # No matching concept
        'Other': 8522
    }
    ETHNICITY_MAP = {
        'Hispanic': 38003563,
        'Non-Hispanic': 38003564,
        'Unknown': 0 # No matching concept
    }

    transformed_records = []

    for index, row in raw_df.iterrows():
        try:
            person_id = row.get('patient_id')
            if person_id is None:
                logging.warning(f"Skipping record {index} due to missing \'patient_id\'.")
                continue

            gender_source_value = str(row.get('gender', 'UNKNOWN')).upper()
            gender_concept_id = GENDER_MAP.get(gender_source_value, 8521) # Default to Other/Unknown

            birth_date_str = row.get('birth_date')
            year_of_birth, month_of_birth, day_of_birth, birth_datetime = None, None, None, None
            if birth_date_str:
                try:
                    dt_obj = datetime.strptime(birth_date_str, '%Y-%m-%d')
                    year_of_birth = dt_obj.year
                    month_of_birth = dt_obj.month
                    day_of_birth = dt_obj.day
                    birth_datetime = dt_obj.isoformat()
                except ValueError:
                    logging.warning(f"Record {person_id}: Invalid birth_date format \'{birth_date_str}\'. Skipping date fields.")

            race_source_value = str(row.get('race_desc', 'UNKNOWN'))
            race_concept_id = RACE_MAP.get(race_source_value, 0) # Default to 0 (No matching concept)

            ethnicity_source_value = str(row.get('ethnicity_desc', 'UNKNOWN'))
            ethnicity_concept_id = ETHNICITY_MAP.get(ethnicity_source_value, 0) # Default to 0

            transformed_records.append({
                'person_id': person_id,
                'gender_concept_id': gender_concept_id,
                'year_of_birth': year_of_birth,
                'month_of_birth': month_of_birth,
                'day_of_birth': day_of_birth,
                'birth_datetime': birth_datetime,
                'race_concept_id': race_concept_id,
                'ethnicity_concept_id': ethnicity_concept_id,
                'location_id': None, # Not in source, set to None
                'provider_id': None,
                'care_site_id': None,
                'person_source_value': person_id,
                'gender_source_value': gender_source_value,
                'gender_source_concept_id': 0, # Not mapping source concepts for demo
                'race_source_value': race_source_value,
                'race_source_concept_id': 0,
                'ethnicity_source_value': ethnicity_source_value,
                'ethnicity_source_concept_id': 0
            })
        except Exception as e:
            logging.error(f"Error transforming record {index} (Patient ID: {row.get('patient_id', 'N/A')}): {e}")

    if not transformed_records:
        logging.warning("No records were successfully transformed to OMOP PERSON.")
        return None

    omop_person_df = pd.DataFrame(transformed_records)
    logging.info(f"Successfully transformed {len(omop_person_df)} records to OMOP PERSON.")
    return omop_person_df

# --- 4. Data Loading (Database Version) ---
def load_omop_data(omop_df, table_name): # Removed output_dir parameter as we\'re now writing to DB
    """
    Loads transformed OMOP data into the PostgreSQL database.
    
    Args:
        omop_df (pd.DataFrame): DataFrame containing OMOP-formatted data.
        table_name (str): The name of the OMOP table (e.g., 'PERSON').
        
    Returns:
        bool: True if loading is successful, False otherwise.
    """
    logging.info(f"Attempting to load data to OMOP {table_name} table in PostgreSQL...")
    if omop_df is None or omop_df.empty:
        logging.warning(f"No data to load for OMOP {table_name}. Skipping load step.")
        return False

    engine = get_db_engine() # Get the database engine
    if engine is None:
        logging.critical(f"Database engine not available. Cannot load data for {table_name}.")
        return False

    try:
        # Use to_sql for efficient DataFrame insertion
        # name: target table name (lowercase is common for PostgreSQL)
        # con: SQLAlchemy engine
        # if_exists='append': adds new rows to the table
        # index=False: do not write DataFrame index as a column in the database
        omop_df.to_sql(name=table_name.lower(), con=engine, if_exists='append', index=False)
        logging.info(f"Successfully loaded {len(omop_df)} records to {table_name} table.")
        return True
    except IntegrityError as ie:
        logging.error(f"Integrity Error during data loading for {table_name}. This often means duplicate primary keys or constraint violations: {ie}")
        return False
    except SQLAlchemyError as sa_e:
        logging.error(f"SQLAlchemy Error during data loading for {table_name}: {sa_e}")
        return False
    except Exception as e:
        logging.error(f"General Error during data loading for {table_name}: {e}")
        return False
        
# --- 5. Main ETL Orchestration ---
def run_omop_etl():
    \"\"\"
    Orchestrates the full OMOP ETL pipeline.
    \"\"\"
    logging.info("--- Starting OMOP ETL Pipeline ---")

    # Step E: Extract
    raw_data = extract_source_data()
    if raw_data is None:
        logging.critical("ETL pipeline terminated due to extraction failure.")
        return False

    # Step T: Transform to PERSON
    omop_person_df = transform_to_omop_person(raw_data)
    if omop_person_df is None:
        logging.critical("ETL pipeline terminated due to critical transformation failure for PERSON.")
        return False

    # Step L: Load PERSON
    if not load_omop_data(omop_person_df, 'PERSON'):
        logging.critical("ETL pipeline terminated due to loading failure for PERSON.")
        return False
        
    logging.info("--- OMOP ETL Pipeline Completed Successfully ---")
    return True

# --- Entry Point ---
if __name__ == "__main__":
    if run_omop_etl():
        logging.info("OMOP ETL script finished.")
    else:
        logging.error("OMOP ETL script finished with errors.")