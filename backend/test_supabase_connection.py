import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env before anything else
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print("--- Supabase Connection Test ---")
print(f"SUPABASE_URL set?      : {bool(SUPABASE_URL)}")
print(f"ANON_KEY set?          : {bool(ANON_KEY)}")
print(f"SERVICE_ROLE_KEY set?  : {bool(SERVICE_ROLE_KEY)}")

if not SUPABASE_URL:
    print("❌ SUPABASE_URL is missing. Aborting test.")
    exit(1)

key_to_use = SERVICE_ROLE_KEY or ANON_KEY
if not key_to_use:
    print("❌ No Supabase key found (.env needs SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY). Aborting test.")
    exit(1)

print(f"Using key: {'SERVICE_ROLE_KEY' if SERVICE_ROLE_KEY else 'ANON_KEY'}\n")

try:
    client: Client = create_client(SUPABASE_URL, key_to_use)
    response = client.table("user_profiles").select("id").limit(1).execute()
    if response.error:
        print("⚠️  Query returned an error:")
        print(response.error)
    else:
        print("✅ Successfully connected and ran a simple query.")
        print(f"   Rows returned : {len(response.data)} (RLS may hide data if using anon key).")
except Exception as e:
    print("❌ Exception while connecting/querying Supabase:")
    print(e) 
 
 
 
 
 
 
 
 
 
 