from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class MethodStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"

# ─── MAIN METHOD TABLE ────────────────────────────────────────────
class Method(Base):
    __tablename__ = "methods"

    id = Column(Integer, primary_key=True, index=True)
    
    # Basic identification
    title = Column(String(300), nullable=False)
    analyte = Column(String(200), nullable=False)
    analyte_normalized = Column(String(200), nullable=True, index=True)
    analyte_cas = Column(String(50), nullable=True)
    analyte_inchikey = Column(String(100), nullable=True)
    analyte_exact_mass = Column(Float, nullable=True)
    matrix = Column(String(50), nullable=False)
    clinical_application = Column(String(200), nullable=True)

    # Ionization
    ionization_mode = Column(String(20), nullable=False)
    
    # Instrument
    instrument_manufacturer = Column(String(50), nullable=False)
    instrument_model = Column(String(100), nullable=False)
    
    # Column
    column_brand = Column(String(100), nullable=False)
    column_name = Column(String(200), nullable=False)
    column_stationary_phase = Column(String(100), nullable=True)
    column_length_mm = Column(Float, nullable=True)
    column_diameter_mm = Column(Float, nullable=True)
    column_particle_size_um = Column(Float, nullable=True)
    column_temperature_c = Column(Float, nullable=True)
    
    # Mobile phases
    mobile_phase_a = Column(String(300), nullable=True)
    mobile_phase_b = Column(String(300), nullable=True)
    
    # Injection
    injection_volume_ul = Column(Float, nullable=True)
    autosampler_temperature_c = Column(Float, nullable=True)
    needle_wash_solvent = Column(String(200), nullable=True)
    
    # MS Source parameters
    capillary_voltage_v = Column(Float, nullable=True)
    source_temperature_c = Column(Float, nullable=True)
    desolvation_temperature_c = Column(Float, nullable=True)
    desolvation_gas_flow = Column(Float, nullable=True)
    capillary_voltage_pos_v = Column(Float, nullable=True)
    capillary_voltage_neg_v = Column(Float, nullable=True)
    # Waters source params
    desolvation_gas_flow_lh = Column(Float, nullable=True)
    cone_gas_flow_lh = Column(Float, nullable=True)
    # Shimadzu source params
    interface_voltage_kv = Column(Float, nullable=True)
    heating_gas_flow = Column(Float, nullable=True)
    dl_temperature = Column(Float, nullable=True)
    interface_temperature = Column(Float, nullable=True)
    nebulizing_gas = Column(Float, nullable=True)
    drying_gas = Column(Float, nullable=True)
    heat_block_temperature = Column(Float, nullable=True)
    # Sciex source params
    ion_spray_voltage = Column(Float, nullable=True)
    gas1 = Column(Float, nullable=True)
    gas2 = Column(Float, nullable=True)
    # Agilent source params
    gas_temperature = Column(Float, nullable=True)
    gas_flow_lmin = Column(Float, nullable=True)
    nebulizer_pressure_psi = Column(Float, nullable=True)
    sheath_gas_heater_c = Column(Float, nullable=True)
    sheath_gas_flow_lmin = Column(Float, nullable=True)
    nozzle_voltage_v = Column(Float, nullable=True)
    curtain_gas = Column(Float, nullable=True)
    collision_gas = Column(String(50), nullable=True)
    
    # Sample prep
    sample_prep_method = Column(String(100), nullable=True)
    sample_prep_details = Column(Text, nullable=True)
    
    # Validation summary
    lloq = Column(Float, nullable=True)
    uloq = Column(Float, nullable=True)
    cv_intra_percent = Column(Float, nullable=True)
    cv_inter_percent = Column(Float, nullable=True)
    recovery_percent = Column(Float, nullable=True)
    
    # Files
    chromatogram_image = Column(String(500), nullable=True)
    sop_pdf = Column(String(500), nullable=True)
    
    # Metadata
    laboratory = Column(String(200), nullable=True)
    country = Column(String(100), nullable=True)
    reference = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_derivatized = Column(Integer, default=0)
    submitted_by = Column(String(200), nullable=True)
    submitted_by_email = Column(String(200), nullable=True)
    lloq_unit = Column(String(20), default='ng/mL')
    view_count = Column(Integer, default=0)
    validation_units = Column(String(20), default='ng/mL')
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    compound_validations = relationship("CompoundValidation", back_populates="method", cascade="all, delete-orphan")
    gradient_steps = relationship("GradientStep", back_populates="method", cascade="all, delete-orphan")
    mrm_transitions = relationship("MRMTransition", back_populates="method", cascade="all, delete-orphan")


# ─── GRADIENT TABLE ───────────────────────────────────────────────
class GradientStep(Base):
    __tablename__ = "gradient_steps"

    id = Column(Integer, primary_key=True, index=True)
    method_id = Column(Integer, ForeignKey("methods.id"), nullable=False)
    time_min = Column(Float, nullable=False)
    percent_b = Column(Float, nullable=False)
    flow_rate_ml_min = Column(Float, nullable=True)
    curve = Column(String(20), nullable=True)  # linear, step, etc.

    method = relationship("Method", back_populates="gradient_steps")


# ─── MRM TRANSITIONS TABLE ────────────────────────────────────────
class MRMTransition(Base):
    __tablename__ = "mrm_transitions"

    id = Column(Integer, primary_key=True, index=True)
    method_id = Column(Integer, ForeignKey("methods.id"), nullable=False)
    compound_name = Column(String(200), nullable=False)
    is_internal_standard = Column(Integer, default=0)  # 0=analyte, 1=IS
    precursor_mz = Column(Float, nullable=False)
    product_mz = Column(Float, nullable=False)
    collision_energy_ev = Column(Float, nullable=True)
    declustering_potential = Column(Float, nullable=True)
    cell_exit_potential = Column(Float, nullable=True)
    retention_time_min = Column(Float, nullable=True)
    retention_time_window_min = Column(Float, nullable=True)
    dwell_time_ms = Column(Float, nullable=True)
    is_quantifier = Column(Integer, default=1)  # 1=quantifier, 0=qualifier
    # Waters
    cone_voltage = Column(Float, nullable=True)
    # Agilent
    cell_accelerator_voltage = Column(Float, nullable=True)
    # Shimadzu
    q1_pre_bias = Column(Float, nullable=True)
    q3_pre_bias = Column(Float, nullable=True)
    derivative = Column(String(50), nullable=True)
    # PubChem enrichment
    pubchem_cid = Column(Integer, nullable=True)
    pubchem_formula = Column(String(100), nullable=True)
    pubchem_exact_mass = Column(Float, nullable=True)
    pubchem_adduct = Column(String(20), nullable=True)
    # Thermo
    ms_resolution = Column(String(50), nullable=True)
    max_inject_time_ms = Column(Float, nullable=True)
    rf_lens_v = Column(Float, nullable=True)

    method = relationship("Method", back_populates="mrm_transitions")

class CompoundValidation(Base):
    __tablename__ = "compound_validation"

    id = Column(Integer, primary_key=True, index=True)
    method_id = Column(Integer, ForeignKey("methods.id"), nullable=False)
    compound_name = Column(String(200), nullable=False)
    lod = Column(Float, nullable=True)
    loq = Column(Float, nullable=True)
    r2 = Column(Float, nullable=True)
    cv_percent = Column(Float, nullable=True)
    accuracy_percent = Column(Float, nullable=True)
    matrix = Column(String(100), nullable=True)
    notes = Column(String(500), nullable=True)

    lod_na = Column(Integer, default=0)
    loq_na = Column(Integer, default=0)
    r2_na = Column(Integer, default=0)
    cv_percent_na = Column(Integer, default=0)
    accuracy_percent_na = Column(Integer, default=0)

    method = relationship("Method", back_populates="compound_validations")


class MethodConfirmation(Base):
    __tablename__ = "method_confirmations"

    id = Column(Integer, primary_key=True, index=True)
    method_id = Column(Integer, ForeignKey("methods.id"), nullable=False)
    laboratory = Column(String(200), nullable=True)
    country = Column(String(100), nullable=True)
    instrument = Column(String(200), nullable=True)
    comment = Column(String(500), nullable=True)
    rating = Column(Integer, default=5)
    created_at = Column(DateTime, default=datetime.utcnow)
