from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

class FAQCreate(BaseModel):
    guild_id: str
    question: str
    answer: str
    match_keywords: str

@router.get("")
async def list_faqs(user: dict = Depends(get_current_user)):
    faqs = await db.get_faqs()
    return {"faqs": faqs}

@router.post("")
async def create_faq(body: FAQCreate, user: dict = Depends(get_current_user)):
    await db.add_faq(
        body.guild_id, 
        body.question, 
        body.answer, 
        body.match_keywords, 
        user.get("user_id", "admin")
    )
    return {"status": "ok"}

@router.delete("/{faq_id}")
async def delete_faq(faq_id: int, user: dict = Depends(get_current_user)):
    await db.remove_faq(faq_id)
    return {"status": "ok"}
