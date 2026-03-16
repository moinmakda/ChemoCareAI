# Maestro E2E Tests for ChemoCare Mobile
# 
# This directory contains Maestro flow files for end-to-end testing.
# Run with: maestro test .maestro/
#
# Installation:
#   macOS: brew install maestro
#   Other: curl -Ls "https://get.maestro.mobile.dev" | bash
#
# Usage:
#   maestro test .maestro/flows/login.yaml
#   maestro test .maestro/  # Run all flows

## Directory Structure:
# .maestro/
# ├── flows/
# │   ├── auth/
# │   │   ├── login.yaml
# │   │   ├── register.yaml
# │   │   └── forgot-password.yaml
# │   ├── patient/
# │   │   ├── home.yaml
# │   │   ├── vitals.yaml
# │   │   └── symptoms.yaml
# │   └── nurse/
# │       ├── medications.yaml
# │       └── vitals-entry.yaml
# └── shared/
#     └── login-helper.yaml
