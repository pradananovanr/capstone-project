# QA-Gen: Interactive API & Feature Test Case Generator

**Capstone Project – IBM SkillsBuild x Hacktiv8 (Track IT: AI Agent for Programming)**  
**Built with:** IBM Bob (Agent Mode – Vibe Coding)

---

## 📌 Project Overview

**QA-Gen** is a lightweight, client-side web application designed to help Software Engineers and Quality Assurance (QA) Engineers rapidly generate structured, comprehensive software test cases from feature specifications or REST API endpoint definitions. 

Instead of manually writing repetitive test scenarios and risking missed edge cases, QA-Gen streamlines the test design workflow by automatically producing **Positive**, **Negative**, and **Edge/Security** test scenarios—complete with preconditions, step-by-step execution instructions, expected results, real-time execution tracking, and export capabilities.

---

## 🎯 Problem Statement

During the Software Development Life Cycle (SDLC), drafting thorough test case documentation is often time-consuming and prone to human oversight. Under tight deadlines, developers frequently focus only on "happy path" scenarios while neglecting negative validations, boundary conditions, and basic security checks (such as XSS or SQL Injection payloads). When these edge cases go untested, critical bugs can slip into production, reducing system reliability and increasing remediation costs.

---

## 👥 Target Users

* **Backend & Frontend Developers:** Need a fast way to validate API endpoints and UI features before pushing code to staging or production.
* **Quality Assurance (QA) Engineers:** Need a structured tool to generate baseline test suites, track execution statuses (`Pending`, `Passed`, `Failed`), and export documentation into Jira, TestRail, or Markdown reports.

---

## ✨ Key Features

1. **Feature & API Specification Input:** Configure Feature Name / API Endpoint (e.g., `POST /api/v1/login`), Module Category (`Authentication`, `Payment`, `CRUD Data`, `User Profile`), Priority (`High`, `Medium`, `Low`), and Acceptance Criteria / Payload details.
2. **Automated Test Case Generation Engine:** Dynamically generates 6–8 structured test cases covering **Positive**, **Negative**, and **Edge/Security** scenarios tailored to the input context.
3. **Interactive Execution Dashboard:** View test cases with Test IDs (`TC-001`), category badges, preconditions, test steps, expected results, and interactive status dropdowns (`Pending`, `Passed`, `Failed`).
4. **Real-Time Filtering & Search:** Filter test cases dynamically by scenario type (`All`, `Positive`, `Negative`, `Edge Case`) or search by keyword/Test ID without reloading the page.
5. **Custom Test Case Creation:** Manually append additional custom edge cases directly into the active test suite.
6. **Persistent Storage (`localStorage`):** Automatically saves generated test suites and execution statuses in the browser so progress is preserved across page refreshes.
7. **One-Click Export & Demo Mode:** Export test suites to properly escaped **CSV** files or **Markdown** format, plus a **Load Sample Input** button for instant demonstration.

---

## 🛠️ Tech Stack

* **AI Development Partner:** IBM Bob (Agent Mode)
* **Frontend:** Semantic HTML5, Tailwind CSS (via CDN), Custom CSS (`style.css`)
* **Logic & State Management:** Modular Vanilla JavaScript (`script.js`) with Browser `localStorage`

---

## 📂 Project Structure

```text
Capstone-IBMBob-QAGen/
├── index.html      # Semantic UI layout and Tailwind CSS configuration
├── style.css       # Custom styling, animations, and scrollbar enhancements
├── script.js       # Test case generation engine, filtering, localStorage, & CSV/Markdown export
└── README.md       # Project documentation
```

---

## 🚀 How to Run Locally

1. Clone or download this repository/folder to your local machine.
2. Open the project folder in **IBM Bob** or **Visual Studio Code**.
3. Launch `index.html` using the **Live Server** extension (or open `index.html` directly in any modern web browser).
4. Click **"Load Sample Input"** followed by **"Generate Test Cases"** to explore the features immediately.

---

## 🧠 Prompt Engineering Methodology (IBM Bob)

This project was built using a **3-Layer Prompt Architecture** followed by **Targeted Iterative Refinement** in IBM Bob's Agent mode:

* **Layer 1 (Role & Context):** Defined IBM Bob as a Senior Frontend & QA Automation Engineer building a zero-framework web application separated into `index.html`, `style.css`, and `script.js`.
* **Layer 2 (Task & Requirements):** Specified the input parameters, rule-based test case generation categories (Positive, Negative, Edge/Security), execution status tracking, and export requirements.
* **Layer 3 (Constraints & Output):** Enforced a responsive dark-slate UI, XSS input sanitization, `localStorage` persistence, and clean, commented code.
* **Iterative Refinement:** Added real-time keyword search, manual custom test case entry, and RFC-compliant CSV escaping with toast notifications.

---

## 🔮 Future Enhancements

* Direct integration with **IBM watsonx.ai** LLM APIs to parse uploaded OpenAPI/Swagger (`.json`/`.yaml`) specifications automatically.
* One-click code generation to export test cases into automated testing scripts (e.g., Playwright, Cypress, or Jest).