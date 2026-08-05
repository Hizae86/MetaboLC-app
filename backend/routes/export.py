from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Method, MRMTransition
import xml.etree.ElementTree as ET
from xml.dom import minidom

router = APIRouter()

def generate_qmf(method: Method, transitions: list) -> str:
    """Generate Analyst .qmf XML for Sciex instruments"""
    
    root = ET.Element("AnalystQS_Method")
    root.set("version", "1.0")
    
    # Method info
    info = ET.SubElement(root, "MethodInfo")
    ET.SubElement(info, "MethodName").text = method.title or "MetaboLC Export"
    ET.SubElement(info, "MethodDescription").text = f"Exported from MetaboLC - Method ID {method.id}"
    ET.SubElement(info, "Instrument").text = method.instrument_model or "Unknown"
    ET.SubElement(info, "ExportedFrom").text = "MetaboLC Repository"

    # MS Method
    ms = ET.SubElement(root, "MSMethod")
    
    # Source parameters
    source = ET.SubElement(ms, "SourceParameters")
    ET.SubElement(source, "IonizationMode").text = "ESI" if "ESI" in (method.ionization_mode or "") else "APCI"
    ET.SubElement(source, "Polarity").text = "Positive" if "+" in (method.ionization_mode or "+") else "Negative"
    if method.ion_spray_voltage:
        ET.SubElement(source, "IonSprayVoltage").text = str(int(method.ion_spray_voltage))
    if method.source_temperature_c:
        ET.SubElement(source, "TemperatureSource").text = str(int(method.source_temperature_c))
    if method.curtain_gas:
        ET.SubElement(source, "CurtainGas").text = str(int(method.curtain_gas))
    if method.gas1:
        ET.SubElement(source, "Gas1").text = str(int(method.gas1))
    if method.gas2:
        ET.SubElement(source, "Gas2").text = str(int(method.gas2))
    if method.collision_gas:
        ET.SubElement(source, "CollisionGas").text = str(method.collision_gas)
    if method.capillary_voltage_pos_v:
        ET.SubElement(source, "CapillaryVoltage").text = str(int(method.capillary_voltage_pos_v))

    # Period
    period = ET.SubElement(ms, "Period")
    ET.SubElement(period, "PeriodName").text = "Period 1"

    # Experiment - MRM
    exp = ET.SubElement(period, "Experiment")
    ET.SubElement(exp, "ExperimentType").text = "MRM"
    ET.SubElement(exp, "ExperimentName").text = "MRM Experiment"

    # MRM Transitions
    mrm_list = ET.SubElement(exp, "MRMTransitionList")
    
    for i, t in enumerate(transitions):
        trans = ET.SubElement(mrm_list, "MRMTransition")
        trans.set("index", str(i))
        
        ET.SubElement(trans, "CompoundName").text = t.compound_name or f"Compound_{i+1}"
        ET.SubElement(trans, "Q1Mass").text = str(t.precursor_mz or 0)
        ET.SubElement(trans, "Q3Mass").text = str(t.product_mz or 0)
        ET.SubElement(trans, "CollisionEnergy").text = str(t.collision_energy_ev or 35)
        ET.SubElement(trans, "DeclusteringPotential").text = str(t.declustering_potential or 80)
        ET.SubElement(trans, "CellExitPotential").text = str(t.cell_exit_potential or 10)
        ET.SubElement(trans, "DwellTime").text = str(t.dwell_time_ms or 50)
        ET.SubElement(trans, "RetentionTime").text = str(t.retention_time_min or 0)
        ET.SubElement(trans, "RetentionTimeWindow").text = str(t.retention_time_window_min or 0.5)
        ET.SubElement(trans, "IsInternalStandard").text = "true" if t.is_internal_standard else "false"
        ET.SubElement(trans, "IsQuantifier").text = "true" if t.is_quantifier else "false"
        if t.cell_accelerator_voltage:
            ET.SubElement(trans, "CellAcceleratorVoltage").text = str(t.cell_accelerator_voltage)

    # Pretty print XML
    xml_str = ET.tostring(root, encoding='unicode')
    dom = minidom.parseString(xml_str)
    return dom.toprettyxml(indent="  ", encoding=None)


def generate_masslynx_xml(method: Method, transitions: list) -> str:
    """Generate MassLynx compatible XML for Waters instruments"""
    
    root = ET.Element("MassLynxMethod")
    root.set("version", "1.0")
    root.set("software", "MassLynx 4.2")

    info = ET.SubElement(root, "MethodInfo")
    ET.SubElement(info, "Name").text = method.title or "MetaboLC Export"
    ET.SubElement(info, "Instrument").text = method.instrument_model or "Unknown"
    ET.SubElement(info, "ExportedFrom").text = "MetaboLC Repository"

    source = ET.SubElement(root, "SourceParameters")
    if method.capillary_voltage_v:
        ET.SubElement(source, "CapillaryVoltage").text = str(method.capillary_voltage_v)
    if method.source_temperature_c:
        ET.SubElement(source, "SourceTemperature").text = str(int(method.source_temperature_c))
    if method.desolvation_temperature_c:
        ET.SubElement(source, "DesolvationTemperature").text = str(int(method.desolvation_temperature_c))
    if method.desolvation_gas_flow_lh:
        ET.SubElement(source, "DesolvationGasFlow").text = str(method.desolvation_gas_flow_lh)
    if method.cone_gas_flow_lh:
        ET.SubElement(source, "ConeGasFlow").text = str(method.cone_gas_flow_lh)

    mrm_list = ET.SubElement(root, "MRMTransitions")
    for i, t in enumerate(transitions):
        trans = ET.SubElement(mrm_list, "Transition")
        trans.set("index", str(i))
        ET.SubElement(trans, "CompoundName").text = t.compound_name or f"Compound_{i+1}"
        ET.SubElement(trans, "ParentMass").text = str(t.precursor_mz or 0)
        ET.SubElement(trans, "DaughterMass").text = str(t.product_mz or 0)
        ET.SubElement(trans, "CollisionEnergy").text = str(t.collision_energy_ev or 25)
        ET.SubElement(trans, "ConeVoltage").text = str(t.cone_voltage or 40)
        ET.SubElement(trans, "DwellTime").text = str(t.dwell_time_ms or 50)
        ET.SubElement(trans, "RetentionTime").text = str(t.retention_time_min or 0)
        ET.SubElement(trans, "IsInternalStandard").text = "true" if t.is_internal_standard else "false"

    xml_str = ET.tostring(root, encoding='unicode')
    dom = minidom.parseString(xml_str)
    return dom.toprettyxml(indent="  ", encoding=None)


@router.get("/methods/{method_id}/export/analyst")
def export_analyst_qmf(method_id: int, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    if method.instrument_manufacturer not in ['Sciex', 'SCIEX']:
        raise HTTPException(status_code=400, detail="Analyst export only available for Sciex methods")

    transitions = db.query(MRMTransition).filter(
        MRMTransition.method_id == method_id
    ).order_by(
        MRMTransition.is_internal_standard,
        MRMTransition.retention_time_min
    ).all()

    xml_content = generate_qmf(method, transitions)
    filename = f"MetaboLC_Method_{method_id}_{(method.analyte or 'method')[:30].replace(' ','_')}.qmf"
    
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/methods/{method_id}/export/masslynx")
def export_masslynx_csv(method_id: int, db: Session = Depends(get_db)):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")

    transitions = db.query(MRMTransition).filter(
        MRMTransition.method_id == method_id
    ).order_by(
        MRMTransition.is_internal_standard,
        MRMTransition.retention_time_min
    ).all()

    # MassLynx/TargetLynx compatible CSV format
    lines = ["Compound,Parent Ion (m/z),Daughter Ion (m/z),Cone (V),Collision Energy (eV),Dwell Time (ms),Retention Time (min),RT Window (min),Role"]
    for t in transitions:
        role = 'IS' if t.is_internal_standard else ('Quantifier' if t.is_quantifier else 'Qualifier')
        lines.append(','.join([
            str(t.compound_name or ''),
            str(t.precursor_mz or ''),
            str(t.product_mz or ''),
            str(t.cone_voltage or 40),
            str(t.collision_energy_ev or 25),
            str(t.dwell_time_ms or 50),
            str(t.retention_time_min or ''),
            str(t.retention_time_window_min or 0.5),
            role
        ]))

    csv_content = '\n'.join(lines)
    filename = f"MetaboLC_Method_{method_id}_{(method.analyte or 'method')[:30].replace(' ','_')}_MassLynx.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
