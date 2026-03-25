import os
import base64
from datetime import datetime, timedelta
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.core.config import settings

# --- Argon2id for Staff Passwords (Blueprint: OWASP Recommended) ---
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# --- AES-256-GCM for Customer PII (Blueprint: DPDP Compliance) ---
def _get_aes_key() -> bytes:
    key = settings.AES_ENCRYPTION_KEY.encode()
    return key[:32]  # Must be exactly 32 bytes

def encrypt_field(plaintext: str) -> str:
    """Encrypts phone/name before storing in DB"""
    aesgcm = AESGCM(_get_aes_key())
    nonce = os.urandom(12)  # 96-bit nonce
    encrypted = aesgcm.encrypt(nonce, plaintext.encode(), None)
    # Store as base64(nonce + ciphertext)
    return base64.b64encode(nonce + encrypted).decode()

def decrypt_field(ciphertext: str) -> str:
    """Decrypts phone/name when reading from DB"""
    aesgcm = AESGCM(_get_aes_key())
    raw = base64.b64decode(ciphertext)
    nonce, encrypted = raw[:12], raw[12:]
    return aesgcm.decrypt(nonce, encrypted, None).decode()

# --- JWT Tokens (Staff + Customer) ---
def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None