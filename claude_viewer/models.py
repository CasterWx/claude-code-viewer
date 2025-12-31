from pydantic import BaseModel

class TagRequest(BaseModel):
    name: str
    color: str = "blue"
