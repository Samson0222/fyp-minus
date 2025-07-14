from langchain_core.tools import tool
from pydantic.v1 import BaseModel, Field
from datetime import datetime
import pytz
from typing import Dict, Any
from dateutil import parser as date_parser

class DateTimeConverterInput(BaseModel):
    natural_language_time: str = Field(description="The natural language string representing a date and/or time (e.g., 'tomorrow at 4pm', 'next Friday').")

@tool("convert_natural_language_to_datetime", args_schema=DateTimeConverterInput)
async def convert_natural_language_to_datetime(natural_language_time: str) -> Dict[str, Any]:
    """
    Use this tool to convert a user's informal date or time reference (like "tomorrow" or "in 2 hours")
    into a precise, machine-readable ISO 8601 datetime string. This is a necessary first step
    before using any tool that requires a 'start_time' or 'end_time', such as 'create_calendar_event'.
    """
    try:
        # The dateutil parser is powerful and can handle many natural language formats.
        # fuzzy=True helps resolve ambiguous inputs like "Tuesday" to the *next* Tuesday.
        parsed_time = date_parser.parse(natural_language_time, fuzzy=True)
        
        # Ensure the datetime is timezone-aware (assuming UTC if not specified)
        if parsed_time.tzinfo is None:
            parsed_time = parsed_time.replace(tzinfo=datetime.timezone.utc)
            
        iso_time = parsed_time.isoformat()
        
        return {
            "status": "success",
            "iso_8601_string": iso_time,
            "interpretation": f"Interpreted '{natural_language_time}' as {iso_time}"
        }
    except date_parser.ParserError:
        return {"error": f"Could not understand the date/time: '{natural_language_time}'. Please be more specific."}
    except Exception as e:
        return {"error": f"An unexpected error occurred during date parsing: {e}"} 

@tool
def get_current_time() -> str:
    """
    Returns the current date and time in a structured format, localized to Kuala Lumpur.
    """
    kl_timezone = pytz.timezone("Asia/Kuala_Lumpur")
    current_time = datetime.now(kl_timezone)
    return current_time.strftime("%Y-%m-%d %H:%M:%S %Z") 