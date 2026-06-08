import os
import httpx
import logging

logger = logging.getLogger(__name__)

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")

# The WhatsApp Graph API URL
# Format: https://graph.facebook.com/v19.0/{phone_number_id}/messages
GRAPH_API_URL = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"

async def send_whatsapp_message(to_phone_number: str, template_name: str, variables: list = None):
    """
    Sends a WhatsApp message using Meta's Graph API.
    
    :param to_phone_number: The recipient's phone number with country code (e.g., '919876543210')
    :param template_name: The name of the approved template in Meta Business Manager
    :param variables: A list of string variables to fill in the template (e.g., ["John", "100.00", "https://link.com"])
    """
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_NUMBER_ID:
        logger.warning("WhatsApp API credentials missing. Skipping message send.")
        return False
        
    # Ensure phone number doesn't have '+' sign as Meta expects just the country code and number
    to_phone_number = to_phone_number.replace("+", "")

    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    
    # Construct template payload
    # This assumes a text-based template. For buttons/media, the payload will differ.
    components = []
    if variables:
        parameters = [{"type": "text", "text": str(var)} for var in variables]
        components.append(
            {
                "type": "body",
                "parameters": parameters
            }
        )
        
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone_number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": "en" # adjust as needed depending on your template's language
            },
            "components": components
        }
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GRAPH_API_URL, 
                headers=headers, 
                json=payload,
                timeout=10.0
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Successfully sent WhatsApp message to {to_phone_number}")
                return True
            else:
                logger.error(f"Failed to send WhatsApp message. Status: {response.status_code}, Response: {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Exception sending WhatsApp message: {str(e)}")
        return False
