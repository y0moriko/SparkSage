from __future__ import annotations
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from api.deps import get_current_user

router = APIRouter()

KNOWLEDGE_DIR = "sparksage/knowledge"

@router.get("/")
async def list_knowledge_files(user: dict = Depends(get_current_user)):
    """List all files in the knowledge base."""
    if not os.path.exists(KNOWLEDGE_DIR):
        return {"files": []}
    
    files = []
    for filename in os.listdir(KNOWLEDGE_DIR):
        file_path = os.path.join(KNOWLEDGE_DIR, filename)
        if os.path.isfile(file_path):
            files.append({
                "name": filename,
                "size": os.path.getsize(file_path),
                "type": filename.split(".")[-1] if "." in filename else "txt"
            })
    return {"files": files}

@router.post("/upload")
async def upload_knowledge_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload a new knowledge file."""
    if not file.filename.endswith((".txt", ".md", ".json")):
        raise HTTPException(status_code=400, detail="Only .txt, .md, and .json files are supported.")
    
    os.makedirs(KNOWLEDGE_DIR, exist_ok=True)
    file_path = os.path.join(KNOWLEDGE_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    return {"status": "ok", "filename": file.filename}

@router.delete("/{filename}")
async def delete_knowledge_file(filename: str, user: dict = Depends(get_current_user)):
    """Delete a knowledge file."""
    file_path = os.path.join(KNOWLEDGE_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="File not found")
