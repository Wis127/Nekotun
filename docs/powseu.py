import subprocess

result = subprocess.run(
    ["powershell", "-Command", "ipconfig"],
    capture_output=True,
    text=True,
)
print("Output",result.stdout)
print("Exit code",result.returncode)
if result.returncode != 0:
    print("errorigga")
