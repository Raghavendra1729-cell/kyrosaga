import { useEffect, useState } from "react"

interface BackendStatus {
  message: string
  storageDriver: string
  modelId: string
}

function App() {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState<BackendStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState("")
  const [generationError, setGenerationError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Backend connection failed")
        }
        return res.json()
      })
      .then((data) => {
        setStatus({
          message: data.message,
          storageDriver: data.storage_driver,
          modelId: data.model_id,
        })
      })
      .catch((err) => {
        setStatusError(err instanceof Error ? err.message : "Unknown error occurred")
      })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) {
      return
    }
    setLoading(true)
    setResponse("")
    setGenerationError(null)

    fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.detail || "Generation request failed")
          })
        }
        return res.json()
      })
      .then((data) => {
        setResponse(data.response)
      })
      .catch((err) => {
        setGenerationError(err instanceof Error ? err.message : "Generation failed")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 selection:bg-neutral-800">
      <div className="max-w-lg w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 backdrop-blur-md shadow-2xl flex flex-col items-center text-center">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-neutral-200 to-neutral-400 bg-clip-text text-transparent mb-2">
          Kyrosaga
        </h1>
        <p className="text-neutral-400 text-sm mb-6">
          Multimodal Product Catalogue Intelligence System
        </p>
        
        <div className="w-full h-px bg-neutral-800 mb-6" />

        {statusError ? (
          <div className="w-full p-4 mb-6 bg-red-950/20 border border-red-900/50 text-red-400 rounded-lg text-sm">
            {statusError}
          </div>
        ) : status ? (
          <div className="w-full p-4 mb-6 bg-emerald-950/20 border border-emerald-900/50 text-emerald-400 rounded-lg text-sm flex flex-col gap-1 text-left">
            <div className="font-semibold text-xs text-neutral-400">System Connection Status</div>
            <div className="font-mono text-xs">{status.message}</div>
            <div className="text-neutral-400 text-xs mt-1">
              Storage: <span className="text-emerald-500 font-mono">{status.storageDriver}</span>
            </div>
            <div className="text-neutral-400 text-xs">
              Parser: <span className="text-emerald-500 font-mono">{status.modelId}</span>
            </div>
          </div>
        ) : (
          <div className="w-full p-4 mb-6 bg-neutral-900/80 border border-neutral-800 text-neutral-400 rounded-lg text-sm">
            Connecting to backend...
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-start gap-4 mb-6">
          <label htmlFor="prompt-input" className="text-xs text-neutral-400 font-semibold">
            Test Prompt (Front-Back-Model Loop)
          </label>
          <textarea
            id="prompt-input"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your message to test the full pipeline..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-sm focus:outline-none focus:border-neutral-700 placeholder:text-neutral-600 resize-none transition-all"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-950 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating Response..." : "Send Request"}
          </button>
        </form>

        {generationError && (
          <div className="w-full p-4 mb-6 bg-red-950/20 border border-red-900/50 text-red-400 rounded-lg text-sm text-left">
            <div className="font-semibold mb-1 text-xs">Error details</div>
            <div className="font-mono text-xs">{generationError}</div>
          </div>
        )}

        {response && (
          <div className="w-full p-4 mb-6 bg-neutral-900/80 border border-neutral-800 text-neutral-200 rounded-lg text-sm text-left max-h-60 overflow-y-auto">
            <div className="font-semibold text-xs text-neutral-400 mb-2">Model response</div>
            <div className="whitespace-pre-wrap font-sans leading-relaxed text-sm">{response}</div>
          </div>
        )}

        <div className="w-full h-px bg-neutral-800 mb-6" />

        <div className="flex justify-between items-center w-full">
          <button
            type="button"
            onClick={() => setCount((c) => c + 1)}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-all"
          >
            Count: {count}
          </button>
          <span className="text-neutral-500 text-xs">
            Bishwayan Chatterjee
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
