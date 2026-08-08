#!/bin/bash
set -euo pipefail

# Never block on credentials, merge editor, pager, or other interactive prompts.
export GIT_TERMINAL_PROMPT=0
export GIT_EDITOR=true
export GIT_SEQUENCE_EDITOR=true
export GIT_PAGER=cat
export PAGER=cat

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$PROJECT_ROOT/test-conflict-repo"

# Clean slate
rm -rf "$REPO_DIR"
mkdir -p "$REPO_DIR"
cd "$REPO_DIR"

git init -q -b master
git config user.email "gitview@test.com"
git config user.name "GitView Diff Test"
git config core.editor true
git config core.autocrlf false

# =============================================================================
# INITIAL COMMIT - base files on master
# =============================================================================

# 1. Simple text file (classic line conflict)
cat > file.txt <<'EOF'
line1
line2
line3
EOF

# 2. JavaScript file with function
cat > utils.js <<'EOF'
function greet(name) {
  return "Hello, " + name;
}

function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { greet, add, multiply };
EOF

# 3. TypeScript file with interface and types
cat > types.ts <<'EOF'
export interface User {
  id: number;
  name: string;
  email: string;
}

export type Status = "active" | "inactive" | "pending";

export function getUser(id: number): User {
  return { id, name: "test", email: "test@test.com" };
}
EOF

# 4. JSON config file
cat > config.json <<'EOF'
{
  "name": "my-app",
  "version": "1.0.0",
  "settings": {
    "debug": false,
    "timeout": 3000,
    "retries": 3
  },
  "features": {
    "darkMode": false,
    "notifications": true
  }
}
EOF

# 5. Multiple files in subdirectory
mkdir -p src/components
cat > src/components/Button.tsx <<'EOF'
import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  variant = "primary",
}) => {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
};
EOF

cat > src/components/Input.tsx <<'EOF'
import React from "react";

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
};
EOF

# 6. README for clean merge example
cat > README.md <<'EOF'
# Test Conflict Repo

This is a test repository for gitview.

## Features
- Feature A
- Feature B
EOF

# 7. YAML config
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm test
EOF

# 8. Edge-case conflict seeds (AA / UD / DU)
mkdir -p edge
cat > edge/ud-file.ts <<'EOF'
export const ud = "base";
EOF
cat > edge/du-file.ts <<'EOF'
export const du = "base";
EOF

# 9. Large file with many functions (for multi-hunk conflicts)
cat > services.ts <<'EOF'
export class UserService {
  private users: User[] = [];

  findAll(): User[] {
    return this.users;
  }

  findById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  create(user: User): User {
    this.users.push(user);
    return user;
  }

  update(id: number, data: Partial<User>): User | undefined {
    const user = this.findById(id);
    if (user) {
      Object.assign(user, data);
    }
    return user;
  }

  delete(id: number): boolean {
    const index = this.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }

  search(query: string): User[] {
    return this.users.filter(
      (u) =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
    );
  }
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}
EOF

git add .
git commit -q -m "initial: add base project files"

# =============================================================================
# FEATURE BRANCH - changes on feature
# =============================================================================

git checkout -q -b feature

# 1. Simple text change
cat > file.txt <<'EOF'
line1
ours change
line3
EOF

# 2. JS function modified
cat > utils.js <<'EOF'
function greet(name) {
  return "Hello, " + name + "!";
}

function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b * 2;
}

function subtract(a, b) {
  return a - b;
}

module.exports = { greet, add, multiply, subtract };
EOF

# 3. TypeScript - add new field and change function
cat > types.ts <<'EOF'
export interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

export type Status = "active" | "inactive" | "pending" | "archived";

export function getUser(id: number): User {
  return { id, name: "test", email: "test@test.com", age: 25 };
}
EOF

# 4. JSON config - add new setting, change values
cat > config.json <<'EOF'
{
  "name": "my-app",
  "version": "1.1.0",
  "settings": {
    "debug": true,
    "timeout": 5000,
    "retries": 5
  },
  "features": {
    "darkMode": true,
    "notifications": true
  }
}
EOF

# 5. Component modified
cat > src/components/Button.tsx <<'EOF'
import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  variant = "primary",
  disabled = false,
}) => {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
EOF

# 6. Add new file on feature branch
cat > src/components/Modal.tsx <<'EOF'
import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
EOF

# 7. Services - add new method, modify search
cat > services.ts <<'EOF'
export class UserService {
  private users: User[] = [];

  findAll(): User[] {
    return this.users;
  }

  findById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  create(user: User): User {
    this.users.push(user);
    return user;
  }

  update(id: number, data: Partial<User>): User | undefined {
    const user = this.findById(id);
    if (user) {
      Object.assign(user, data);
    }
    return user;
  }

  delete(id: number): boolean {
    const index = this.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }

  search(query: string): User[] {
    const lowerQuery = query.toLowerCase();
    return this.users.filter(
      (u) =>
        u.name.toLowerCase().includes(lowerQuery) ||
        u.email.toLowerCase().includes(lowerQuery) ||
        u.role.toLowerCase().includes(lowerQuery)
    );
  }

  findByRole(role: User["role"]): User[] {
    return this.users.filter((u) => u.role === role);
  }
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}
EOF

# 8. Edge-case conflicts on feature
mkdir -p edge
cat > edge/aa-file.ts <<'EOF'
export const aa = "feature-add";
EOF
cat > edge/ud-file.ts <<'EOF'
export const ud = "feature-modified";
EOF
git rm -q edge/du-file.ts

# 9. README updated on feature
cat > README.md <<'EOF'
# Test Conflict Repo

This is a test repository for gitview.

## Features
- Feature A
- Feature B
- Feature C (new)
EOF

git add .
git commit -q -m "feature: add dark mode, new components, and improve services"

# =============================================================================
# BACK TO MASTER - conflicting changes
# =============================================================================

git checkout -q master

# 1. Simple text - conflicting change
cat > file.txt <<'EOF'
line1
theirs change
line3
EOF

# 2. JS - different modification
cat > utils.js <<'EOF'
function greet(name) {
  return "Hi, " + name;
}

function add(a, b) {
  return a + b + 1;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  return a / b;
}

module.exports = { greet, add, multiply, divide };
EOF

# 3. TypeScript - different changes
cat > types.ts <<'EOF'
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export type Status = "active" | "inactive" | "pending" | "disabled";

export function getUser(id: number): User {
  return { id, name: "test", email: "test@test.com", role: "user" };
}
EOF

# 4. JSON - different config changes
cat > config.json <<'EOF'
{
  "name": "my-app",
  "version": "1.0.1",
  "settings": {
    "debug": false,
    "timeout": 10000,
    "retries": 1
  },
  "features": {
    "darkMode": false,
    "notifications": false,
    "analytics": true
  }
}
EOF

# 5. Component - different modification
cat > src/components/Button.tsx <<'EOF'
import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  variant = "primary",
  size = "md",
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
EOF

# 6. Delete Input.tsx (delete-modify conflict)
rm src/components/Input.tsx

# 7. Services - different modifications (multi-hunk conflict)
cat > services.ts <<'EOF'
export class UserService {
  private users: User[] = [];

  findAll(): User[] {
    return this.users;
  }

  findById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  create(user: User): User {
    this.users.push(user);
    return user;
  }

  update(id: number, data: Partial<User>): User | undefined {
    const user = this.findById(id);
    if (user) {
      Object.assign(user, data);
    }
    return user;
  }

  delete(id: number): boolean {
    const index = this.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }

  search(query: string, fields: (keyof User)[] = ["name", "email"]): User[] {
    const lowerQuery = query.toLowerCase();
    return this.users.filter((u) =>
      fields.some((field) =>
        String(u[field]).toLowerCase().includes(lowerQuery)
      )
    );
  }

  count(): number {
    return this.users.length;
  }
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}
EOF

# 8. README - different update
cat > README.md <<'EOF'
# Test Conflict Repo

This is a test repository for gitview.

## Features
- Feature A
- Feature B
- Feature D (different new feature)
EOF

# 9. Edge-case conflicts on master
mkdir -p edge
cat > edge/aa-file.ts <<'EOF'
export const aa = "master-add";
EOF
rm -f edge/ud-file.ts
cat > edge/du-file.ts <<'EOF'
export const du = "master-modified";
EOF

# 10. Add new file on master too
mkdir -p src/utils
cat > src/utils/helpers.ts <<'EOF'
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
EOF

git add .
git commit -q -m "main: change line2 differently, update configs, refactor services"

# =============================================================================
# MERGE FEATURE -> MASTER (creates conflicts)
# =============================================================================

git merge --no-edit feature >/dev/null 2>&1 || true

echo "Test repo ready: $REPO_DIR"
