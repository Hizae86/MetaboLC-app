"""Chemistry helpers for the mass calculator.

GET /api/tools/structure?smiles=...  →  molecular formula and monoisotopic mass computed with RDKit.
Salts and counter-ions are dropped (largest fragment kept), so 'CC(=O)O.[Na+]' style inputs work.
RDKit is optional: without it the endpoint answers 503 and the calculator keeps working from formulas.
"""
from fastapi import APIRouter, HTTPException, Query

try:
    from rdkit import Chem, RDLogger
    from rdkit.Chem import Descriptors, rdMolDescriptors
    from rdkit.Chem.MolStandardize import rdMolStandardize
    RDLogger.DisableLog("rdApp.*")
    RDKIT = True
except ImportError:  # pragma: no cover - depends on the deployment
    RDKIT = False

router = APIRouter()


@router.get("/tools/structure")
def structure(smiles: str = Query(..., min_length=1, max_length=2000)):
    if not RDKIT:
        raise HTTPException(503, "SMILES support needs RDKit on the server (pip install rdkit). Formulas still work.")
    mol = Chem.MolFromSmiles(smiles.strip())
    if mol is None:
        raise HTTPException(422, "RDKit could not parse this SMILES.")
    fragments = Chem.GetMolFrags(mol, asMols=True)
    removed = len(fragments) - 1
    if removed:
        mol = rdMolStandardize.LargestFragmentChooser().choose(mol)
    charge = Chem.GetFormalCharge(mol)
    return {
        "formula": rdMolDescriptors.CalcMolFormula(mol),          # includes the charge sign when charged, e.g. C5H14NO+
        "monoisotopic_mass": Descriptors.ExactMolWt(mol),          # mass of the species as drawn (no electron correction)
        "average_mass": Descriptors.MolWt(mol),
        "formal_charge": charge,
        "canonical_smiles": Chem.MolToSmiles(mol),
        "inchikey": Chem.MolToInchiKey(mol) if hasattr(Chem, "MolToInchiKey") else None,
        "fragments_removed": removed,
    }
