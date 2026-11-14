import getpass
import hashlib
import hmac
import json
import os
import sys

USERS_FILE="users.json"
N , R, P = 2**14,8,1


def hash_password(password,salt=None, n=N ,r=R,p=P):
    """Return (salt,hash). Makes a new random salt if none is given."""

    if salt is None:
        salt=os.urandom(16)
    pw_hash = hashlib.scrypt(password.encode(),salt=salt,
    n=n,r=r,p=p)
    return salt,pw_hash
    # provied a random salt to the password (each user and password gets a diffrent salt)
    # which laters get hashed (more encrypted and shortend )
    # and gets merged/encoded with the password

def load_users():
    if not os.path.exists(USERS_FILE):
        return{}
    with open(USERS_FILE) as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE,"w") as f:
        json.dump(users,f,indent=2)

def add_user(username,password):
    users = load_users()
    salt,pw_hash= hash_password(password)
    users[username] = {
        "salt":salt.hex(),
        "hash":pw_hash.hex(),
        "n":N ,"r":R , "p":P
    }
    save_users(users)


def check_login(username,password):
    users = load_users()
    user = users.get(username)
    if user is None:
        return False
    salt = bytes.fromhex(user["salt"])
    stored = bytes.fromhex(user["hash"])
    _, pw_hash = hash_password(password,salt,user["n"],
     user["r"],user["p"])
    return hmac.compare_digest(pw_hash,stored)

if __name__ == "__main__":
    #usage : uv run auth.py alice
    name = sys.argv[1]
    pw = getpass.getpass("password :")
    add_user(name,pw)
    print("added",name)


# hashes the password with the salt and compares it to check if its correct
