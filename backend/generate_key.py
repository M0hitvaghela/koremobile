#!/usr/bin/env python3
"""
Generate encryption key for Fernet field encryption.
Run this once and copy the output to your .env file as ENCRYPTION_KEY.
"""

from cryptography.fernet import Fernet


def generate_encryption_key():
    """Generate a new Fernet encryption key"""
    key = Fernet.generate_key()
    return key.decode()


if __name__ == "__main__":
    key = generate_encryption_key()
    print("\n" + "="*60)
    print("Fernet Encryption Key Generated Successfully")
    print("="*60)
    print(f"\nEncryption Key: {key}\n")
    print("Add this to your .env file as:")
    print(f"ENCRYPTION_KEY={key}\n")
    print("="*60 + "\n")
