import os

file_path = r"c:\Users\adill\Desktop\system_absence\absenceDesktop\src\renderer\pages\manager\WeeklyScheduleImporter.tsx"

print("Reading file...")
with open(file_path, "rb") as f:
    content_bytes = f.read()

# Try decoding with replacement
content_str = content_bytes.decode("utf-8", errors="replace")

# Let's replace the replacement characters or weird characters with clean ones
content_str = content_str.replace("décdage", "decodage")
content_str = content_str.replace("décودage", "decodage")
content_str = content_str.replace("decودage", "decodage")
content_str = content_str.replace("", "")

# Let's save the cleaned content back as clean UTF-8
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content_str)

print("Saved cleaned file.")
