# 🚀 Deploying PolyGlot IDE to Hugging Face Spaces (24/7 Always On, Zero Cost)

Follow these exact steps to get your live IDE running online 24/7 with **no credit card** and **no cold starts/sleeping**:

---

### Step 1: Create a Free Hugging Face Account
1. Open **[https://huggingface.co](https://huggingface.co)** and click **Sign Up** (no credit card needed).

---

### Step 2: Create a New Space
1. In the top navigation bar, click **Spaces** ➔ **Create new Space**.
2. Settings:
   - **Space name:** `polyglot-ide`
   - **License:** `mit`
   - **Space SDK:** Select **Docker** 🐳 ➔ **Blank**
   - **Space hardware:** Keep the default **Free (2 vCPU · 16GB RAM)**
3. Click **Create Space**.

---

### Step 3: Push Your Code (One Command)
Hugging Face will show you a Git clone URL like:
`https://huggingface.co/spaces/YOUR_USERNAME/polyglot-ide`

In your terminal in `c:\D FOLDER\Projects\ide`, run:
```bash
git init
git add .
git commit -m "Deploy PolyGlot IDE with 8 compilers"
git remote add origin https://huggingface.co/spaces/YOUR_USERNAME/polyglot-ide
git branch -M main
git push -u origin main --force
```
*(When prompted for password during git push, generate an Access Token with Write permissions at https://huggingface.co/settings/tokens and paste it).*

---

### Step 4: Your Live IDE is Ready!
Hugging Face will automatically:
1. Build the Docker container.
2. Install GCC, G++, Rust, Go, OpenJDK, Python, Node.js, and TypeScript.
3. Serve your clean Monaco editor frontend and execution backend unified.

Your public link will be live 24/7:
**`https://YOUR_USERNAME-polyglot-ide.hf.space`**
