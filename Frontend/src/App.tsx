import React, { useEffect, useState, useRef } from "react"
import settings from "./config"

interface BackendStatus {
  message: string
  storageDriver: string
  modelId: string
}

interface Product {
  id: string
  title: string
  price: number
  inventory_count: number
  image_url: string
  ai_description: string | null
  extracted_attributes: {
    colour?: string
    style?: string
    material_type?: string
    shape?: string
  } | null
  similarity?: number
}

function App() {
  const [activeTab, setActiveTab] = useState<"search" | "upload">("search")
  const [status, setStatus] = useState<BackendStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  
  const [products, setProducts] = useState<Product[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  
  const [textQuery, setTextQuery] = useState("")
  const [imageQuery, setImageQuery] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [filterMinInventory, setFilterMinInventory] = useState<number>(0)
  const [filterColour, setFilterColour] = useState("")
  const [filterStyle, setFilterStyle] = useState("")
  const [filterMaterial, setFilterMaterial] = useState("")
  const [filterShape, setFilterShape] = useState("")
  
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadPrice, setUploadPrice] = useState("")
  const [uploadStock, setUploadStock] = useState("")
  const [uploadImage, setUploadImage] = useState<File | null>(null)
  const [uploadImagePreview, setUploadImagePreview] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<any | null>(null)
  const [uploadStep, setUploadStep] = useState("")

  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  
  const searchFileRef = useRef<HTMLInputElement>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchStatus()
    loadInitialProducts()
  }, [])

  const fetchStatus = () => {
    fetch(`${settings.apiBaseUrl}/`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Backend connection offline")
        }
        return res.json()
      })
      .then((data) => {
        setStatus({
          message: data.message,
          storageDriver: data.storage_driver,
          modelId: data.model_id,
        })
        setStatusError(null)
      })
      .catch((err) => {
        setStatusError(err instanceof Error ? err.message : "Unknown error")
      })
  }

  const loadInitialProducts = () => {
    setSearchLoading(true)
    fetch(`${settings.apiBaseUrl}/api/products`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load products")
        }
        return res.json()
      })
      .then((data) => {
        setProducts(data)
        setSearchError(null)
      })
      .catch((err) => {
        setSearchError(err instanceof Error ? err.message : "Failed to load catalogue")
      })
      .finally(() => {
        setSearchLoading(false)
      })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textQuery && !imageQuery) {
      loadInitialProducts()
      return
    }
    setSearchLoading(true)
    setSearchError(null)
    setExpandedProductId(null)

    const formData = new FormData()
    if (textQuery) {
      formData.append("text_query", textQuery)
    }
    if (imageQuery) {
      formData.append("image_query", imageQuery)
    }
    if (filterMinInventory > 0) {
      formData.append("min_inventory", String(filterMinInventory))
    }
    if (filterColour) {
      formData.append("colour", filterColour)
    }
    if (filterStyle) {
      formData.append("style", filterStyle)
    }
    if (filterMaterial) {
      formData.append("material_type", filterMaterial)
    }
    if (filterShape) {
      formData.append("shape", filterShape)
    }

    fetch(`${settings.apiBaseUrl}/api/products/search`, {
      method: "POST",
      body: formData,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.detail || "Search request failed")
          })
        }
        return res.json()
      })
      .then((data) => {
        setProducts(data)
      })
      .catch((err) => {
        setSearchError(err instanceof Error ? err.message : "Search failed")
      })
      .finally(() => {
        setSearchLoading(false)
      })
  }

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadTitle.trim() || !uploadPrice || !uploadStock || !uploadImage) {
      setUploadError("All fields including product image are required")
      return
    }
    setUploadLoading(true)
    setUploadError(null)
    setUploadSuccess(null)
    setUploadStep("Uploading and starting ingestion pipeline...")

    const timer1 = setTimeout(() => setUploadStep("Optimizing image asset to WebP (Node 1)..."), 1000)
    const timer2 = setTimeout(() => setUploadStep("Extracting visual properties & generating description via Gemini 3 Flash (Node 2)..."), 2500)
    const timer3 = setTimeout(() => setUploadStep("Projecting features into 3072-dimensional vector field (Node 3)..."), 4500)
    const timer4 = setTimeout(() => setUploadStep("Writing records and synchronizing indexes (Node 4)..."), 6000)

    const formData = new FormData()
    formData.append("file", uploadImage)
    formData.append("title", uploadTitle)
    formData.append("price", uploadPrice)
    formData.append("inventory_count", uploadStock)

    fetch(`${settings.apiBaseUrl}/api/products/upload`, {
      method: "POST",
      body: formData,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.detail || "Ingestion pipeline failed")
          })
        }
        return res.json()
      })
      .then((data) => {
        setUploadSuccess(data)
        setUploadTitle("")
        setUploadPrice("")
        setUploadStock("")
        setUploadImage(null)
        setUploadImagePreview(null)
        loadInitialProducts()
      })
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : "Upload failed")
      })
      .finally(() => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
        clearTimeout(timer4)
        setUploadLoading(false)
        setUploadStep("")
      })
  }

  const handleSearchImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageQuery(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleUploadImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setUploadImage(file)
      setUploadImagePreview(URL.createObjectURL(file))
    }
  }

  const clearSearchImage = () => {
    setImageQuery(null)
    setImagePreview(null)
    if (searchFileRef.current) {
      searchFileRef.current.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-neutral-800">
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              Kyrosaga
            </h1>
            <p className="text-xs text-neutral-500 font-medium">
              Multimodal Product Catalogue Intelligence System
            </p>
          </div>

          <div className="flex items-center gap-4">
            {statusError ? (
              <div className="px-3.5 py-1.5 bg-red-950/20 border border-red-900/40 text-red-400 rounded-lg text-xs font-semibold">
                Backend Connection Offline
              </div>
            ) : status ? (
              <div className="flex items-center gap-6 text-xs bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-neutral-300 font-medium">{status.message}</span>
                </div>
                <div className="text-neutral-500">
                  Storage: <span className="text-neutral-300 font-mono">{status.storageDriver}</span>
                </div>
                <div className="text-neutral-500">
                  Model: <span className="text-neutral-300 font-mono">{status.modelId}</span>
                </div>
              </div>
            ) : (
              <div className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-lg text-xs">
                Synchronizing status...
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-center mb-8">
          <div className="flex bg-neutral-900/80 border border-neutral-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("search")}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "search"
                  ? "bg-neutral-100 text-neutral-950 shadow-md"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Search Catalog
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "upload"
                  ? "bg-neutral-100 text-neutral-950 shadow-md"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Add Product
            </button>
          </div>
        </div>

        {activeTab === "search" && (
          <div className="space-y-8">
            <form onSubmit={handleSearchSubmit} className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 space-y-2">
                  <label htmlFor="search-input" className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                    Semantic Text Query
                  </label>
                  <input
                    id="search-input"
                    type="text"
                    value={textQuery}
                    onChange={(e) => setTextQuery(e.target.value)}
                    placeholder="Describe what you are looking for (e.g. lightweight obsidian running shoes with grip)..."
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 focus:outline-none rounded-xl px-4 py-3 text-sm transition-all"
                  />
                </div>

                <div className="w-full lg:w-80 space-y-2">
                  <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">
                    Visual Query Asset
                  </span>
                  {imagePreview ? (
                    <div className="relative border border-neutral-800 bg-neutral-950 rounded-xl p-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={imagePreview} alt="Query preview" className="w-10 h-10 object-cover rounded-lg border border-neutral-800" />
                        <span className="text-xs text-neutral-300 truncate max-w-[140px]">{imageQuery?.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={clearSearchImage}
                        className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 rounded-lg text-xs font-semibold transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => searchFileRef.current?.click()}
                      className="border border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/50 hover:bg-neutral-950 rounded-xl py-3.5 px-4 text-center cursor-pointer transition-all"
                    >
                      <span className="text-xs text-neutral-500 font-medium">Click to upload image query</span>
                      <input
                        ref={searchFileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSearchImageChange}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-neutral-900 pt-6">
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block mb-4">
                  Relational Pre-Filters
                </span>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-500 font-semibold">Min Stock</label>
                    <input
                      type="number"
                      value={filterMinInventory}
                      onChange={(e) => setFilterMinInventory(Number(e.target.value))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-500 font-semibold">Colour</label>
                    <input
                      type="text"
                      value={filterColour}
                      onChange={(e) => setFilterColour(e.target.value)}
                      placeholder="e.g. black"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-500 font-semibold">Style</label>
                    <input
                      type="text"
                      value={filterStyle}
                      onChange={(e) => setFilterStyle(e.target.value)}
                      placeholder="e.g. modern"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-500 font-semibold">Material</label>
                    <input
                      type="text"
                      value={filterMaterial}
                      onChange={(e) => setFilterMaterial(e.target.value)}
                      placeholder="e.g. leather"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-500 font-semibold">Shape</label>
                    <input
                      type="text"
                      value={filterShape}
                      onChange={(e) => setFilterShape(e.target.value)}
                      placeholder="e.g. polygon"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="px-6 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-950 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {searchLoading ? "Computing Spatial Query..." : "Execute Search"}
                </button>
              </div>
            </form>

            {searchError && (
              <div className="p-4 bg-red-950/20 border border-red-900/40 text-red-400 rounded-xl text-sm font-mono">
                {searchError}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-neutral-200">Catalog Inventory ({products.length} Items)</h2>
                {products.length > 0 && products[0].similarity !== undefined && (
                  <span className="text-xs text-neutral-500 font-medium">Sorted by angular proximity</span>
                )}
              </div>

              {products.length === 0 ? (
                <div className="border border-neutral-900 bg-neutral-950 rounded-2xl py-12 text-center text-neutral-500 text-sm">
                  No products found matching query metrics.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => {
                    const isExpanded = expandedProductId === product.id
                    return (
                      <div
                        key={product.id}
                        onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                        className={`bg-neutral-900/20 hover:bg-neutral-900/40 border rounded-2xl overflow-hidden cursor-pointer transition-all ${
                          isExpanded ? "border-neutral-700" : "border-neutral-900"
                        }`}
                      >
                        <div className="h-48 bg-neutral-950 relative overflow-hidden flex items-center justify-center">
                          <img
                            src={product.image_url}
                            alt={product.title}
                            className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                          />
                          {product.similarity !== undefined && (
                            <div className="absolute top-3 right-3 bg-neutral-950/90 border border-neutral-800 backdrop-blur-md rounded-lg px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                              {(product.similarity * 100).toFixed(1)}% Match
                            </div>
                          )}
                        </div>

                        <div className="p-5 space-y-4">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-neutral-200 text-sm tracking-tight truncate flex-1">
                              {product.title}
                            </h3>
                            <span className="text-xs font-semibold text-neutral-300">
                              ${product.price.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs text-neutral-500">
                            <span>Stock availability: {product.inventory_count}</span>
                            <span className="text-[10px] text-neutral-400 font-semibold bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5">
                              ID: {product.id.slice(0, 8)}
                            </span>
                          </div>

                          {product.extracted_attributes && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {product.extracted_attributes.colour && (
                                <span className="bg-neutral-900 text-neutral-400 border border-neutral-800 text-[10px] px-2 py-0.5 rounded-md">
                                  Colour: {product.extracted_attributes.colour}
                                </span>
                              )}
                              {product.extracted_attributes.style && (
                                <span className="bg-neutral-900 text-neutral-400 border border-neutral-800 text-[10px] px-2 py-0.5 rounded-md">
                                  Style: {product.extracted_attributes.style}
                                </span>
                              )}
                              {product.extracted_attributes.material_type && (
                                <span className="bg-neutral-900 text-neutral-400 border border-neutral-800 text-[10px] px-2 py-0.5 rounded-md">
                                  Material: {product.extracted_attributes.material_type}
                                </span>
                              )}
                              {product.extracted_attributes.shape && (
                                <span className="bg-neutral-900 text-neutral-400 border border-neutral-800 text-[10px] px-2 py-0.5 rounded-md">
                                  Shape: {product.extracted_attributes.shape}
                                </span>
                              )}
                            </div>
                          )}

                          {isExpanded && product.ai_description && (
                            <div className="border-t border-neutral-900 pt-4 mt-2 space-y-2 text-xs text-neutral-300">
                              <span className="font-bold text-neutral-400">Generated Catalog Profile:</span>
                              <p className="leading-relaxed font-sans whitespace-pre-wrap">{product.ai_description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "upload" && (
          <div className="max-w-2xl mx-auto bg-neutral-900/40 border border-neutral-900 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold mb-6 text-neutral-200">Catalog Ingestion Portal</h2>
            
            <form onSubmit={handleUploadSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="upload-title" className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                    Product Title
                  </label>
                  <input
                    id="upload-title"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Enter product title..."
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="upload-price" className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                      Price
                    </label>
                    <input
                      id="upload-price"
                      type="number"
                      step="0.01"
                      value={uploadPrice}
                      onChange={(e) => setUploadPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="upload-stock" className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                      Stock Level
                    </label>
                    <input
                      id="upload-stock"
                      type="number"
                      value={uploadStock}
                      onChange={(e) => setUploadStock(e.target.value)}
                      placeholder="0"
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">
                  Product Image Asset
                </span>
                {uploadImagePreview ? (
                  <div className="relative border border-neutral-800 bg-neutral-950 rounded-xl p-4 flex flex-col items-center justify-center gap-4">
                    <img src={uploadImagePreview} alt="Upload preview" className="max-h-60 object-contain rounded-lg border border-neutral-800" />
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => uploadFileRef.current?.click()}
                        className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 rounded-xl text-xs font-semibold transition-all"
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={() => { setUploadImage(null); setUploadImagePreview(null); }}
                        className="px-4 py-2 bg-red-950/20 border border-red-900/50 hover:bg-red-950/40 text-red-400 rounded-xl text-xs font-semibold transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => uploadFileRef.current?.click()}
                    className="border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/30 hover:bg-neutral-950 rounded-xl py-12 text-center cursor-pointer transition-all"
                  >
                    <span className="text-sm text-neutral-500 font-semibold block mb-1">Drag and drop or click to upload</span>
                    <span className="text-xs text-neutral-600 block">Accepts image files up to 10MB</span>
                    <input
                      ref={uploadFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImageChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {uploadLoading && (
                <div className="p-4 bg-neutral-950 border border-neutral-850 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold text-neutral-300">Agent Pipeline Executing</span>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono leading-relaxed">{uploadStep}</p>
                </div>
              )}

              {uploadError && (
                <div className="p-4 bg-red-950/20 border border-red-900/40 text-red-400 rounded-xl text-xs font-mono">
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-5 bg-emerald-950/10 border border-emerald-900/30 text-emerald-400 rounded-xl space-y-4">
                  <div className="text-sm font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Product Successfully Ingested by System
                  </div>

                  <div className="text-xs text-neutral-300 space-y-2 border-t border-emerald-950/30 pt-3">
                    <div>
                      <span className="font-bold text-neutral-400">Extracted Attributes:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="bg-neutral-950 border border-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded">Colour: {uploadSuccess.colour}</span>
                        <span className="bg-neutral-950 border border-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded">Style: {uploadSuccess.style}</span>
                        <span className="bg-neutral-950 border border-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded">Material: {uploadSuccess.material_type}</span>
                        <span className="bg-neutral-950 border border-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded">Shape: {uploadSuccess.shape}</span>
                      </div>
                    </div>
                    <div className="pt-2">
                      <span className="font-bold text-neutral-400 block mb-1">Synthesized Description:</span>
                      <p className="text-neutral-400 whitespace-pre-wrap leading-relaxed">{uploadSuccess.ai_description}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end border-t border-neutral-900 pt-6">
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="px-6 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-950 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {uploadLoading ? "Processing Pipeline..." : "Ingest Product"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <footer className="border-t border-neutral-900 py-8 px-6 mt-12 text-center">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-neutral-500">
          <span className="font-medium">Kyrosaga Catalog Intelligence</span>
          <span className="font-medium">System workspace assigned for Bish</span>
        </div>
      </footer>
    </div>
  )
}

export default App
