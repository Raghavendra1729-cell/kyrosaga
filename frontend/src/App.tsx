import React, { useEffect, useState, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import settings from "./config"

type Theme = "cobalt" | "lime"
type Mode = "light" | "dark"
type FilterKey = "minStock" | "colour" | "style" | "material" | "shape"

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

const EXAMPLE_QUERIES = [
  "minimalist black leather chair",
  "lightweight running shoes",
  "matte black ceramic mug",
]

function MS({ name, size = 22, fill = false, className = "" }: { name: string; size?: number; fill?: boolean; className?: string }) {
  return (
    <span
      className={`msr ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'opsz' ${size}` }}
    >
      {name}
    </span>
  )
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("k-theme") as Theme) || "cobalt")
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("k-mode") as Mode) || "light")

  const [products, setProducts] = useState<Product[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [isDraggingSearch, setIsDraggingSearch] = useState(false)
  const [isDraggingUpload, setIsDraggingUpload] = useState(false)

  const [textQuery, setTextQuery] = useState("")
  const [imageQuery, setImageQuery] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [filterMinInventory, setFilterMinInventory] = useState<string>("")
  const [filterColour, setFilterColour] = useState("")
  const [filterStyle, setFilterStyle] = useState("")
  const [filterMaterial, setFilterMaterial] = useState("")
  const [filterShape, setFilterShape] = useState("")
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadPrice, setUploadPrice] = useState("")
  const [uploadStock, setUploadStock] = useState("")
  const [uploadImage, setUploadImage] = useState<File | null>(null)
  const [uploadImagePreview, setUploadImagePreview] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<any | null>(null)
  const [uploadStep, setUploadStep] = useState("")

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const searchFileRef = useRef<HTMLInputElement>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)
  const filterRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const body = document.body
    body.classList.remove("theme-cobalt", "theme-lime")
    body.classList.add(`theme-${theme}`)
    if (mode === "dark") body.setAttribute("data-mode", "dark")
    else body.removeAttribute("data-mode")
    localStorage.setItem("k-theme", theme)
    localStorage.setItem("k-mode", mode)
  }, [theme, mode])

  useEffect(() => {
    if (!openFilter) return
    const onClick = (e: MouseEvent) => {
      if (filterRowRef.current && !filterRowRef.current.contains(e.target as Node)) {
        setOpenFilter(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFilter(null)
    }
    window.addEventListener("mousedown", onClick)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onClick)
      window.removeEventListener("keydown", onKey)
    }
  }, [openFilter])

  useEffect(() => {
    if (!selectedProduct && !uploadOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedProduct(null)
        if (!uploadLoading) setUploadOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedProduct, uploadOpen, uploadLoading])

  const loadInitialProducts = () => {
    setSearchLoading(true)
    fetch(`${settings.apiBaseUrl}/api/products`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load products")
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

  const runSearch = (overrideText?: string) => {
    const t = overrideText ?? textQuery
    if (!t && !imageQuery) {
      setProducts([])
      setHasSearched(false)
      return
    }
    setSearchLoading(true)
    setSearchError(null)
    setSelectedProduct(null)

    const formData = new FormData()
    if (t) formData.append("text_query", t)
    if (imageQuery) formData.append("image_query", imageQuery)

    const minInv = parseInt(filterMinInventory, 10)
    if (!Number.isNaN(minInv) && minInv > 0) formData.append("min_inventory", String(minInv))
    if (filterColour) formData.append("colour", filterColour)
    if (filterStyle) formData.append("style", filterStyle)
    if (filterMaterial) formData.append("material_type", filterMaterial)
    if (filterShape) formData.append("shape", filterShape)

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
        setHasSearched(true)
      })
      .catch((err) => {
        setSearchError(err instanceof Error ? err.message : "Search failed")
        setHasSearched(true)
      })
      .finally(() => {
        setSearchLoading(false)
      })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch()
  }

  const handleExampleQuery = (q: string) => {
    setTextQuery(q)
    runSearch(q)
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
    const timer3 = setTimeout(() => setUploadStep("Projecting features into 1024-dimensional vector field (Node 3)..."), 4500)
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

  const handleSearchBarDrop = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsDraggingSearch(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setImageQuery(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleUploadDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingUpload(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setUploadImage(file)
      setUploadImagePreview(URL.createObjectURL(file))
    }
  }

  const clearSearchImage = () => {
    setImageQuery(null)
    setImagePreview(null)
    if (searchFileRef.current) searchFileRef.current.value = ""
  }

  const closeUploadModal = () => {
    if (uploadLoading) return
    setUploadOpen(false)
    setUploadError(null)
    setUploadSuccess(null)
    setUploadStep("")
  }

  const filterChip = (key: FilterKey, label: string, value: string, onClear: () => void, children: React.ReactNode) => {
    const isOpen = openFilter === key
    const isSet = value !== ""
    return (
      <div className="k-filter-chip-wrap" key={key}>
        <button
          type="button"
          className={`k-filter-chip ${isSet ? "set" : ""}`}
          onClick={() => setOpenFilter(isOpen ? null : key)}
        >
          {label}{isSet ? `: ${value}` : ""}
          {isSet ? (
            <span
              role="button"
              aria-label={`Clear ${label}`}
              className="k-fc-clear"
              onClick={(e) => { e.stopPropagation(); onClear() }}
            >
              <MS name="close" size={14} />
            </span>
          ) : (
            <MS name="expand_more" size={16} />
          )}
        </button>
        {isOpen && (
          <div className="k-filter-popover" onClick={(e) => e.stopPropagation()}>
            {children}
            <div className="k-popover-actions">
              <button type="button" className="k-btn-text" onClick={() => setOpenFilter(null)}>Done</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="k-appbar sticky top-0 z-40 px-6 pt-4 pb-5">
        <div className="max-w-7xl mx-auto flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="k-mark" style={{ width: 32, height: 32 }}>
                <span className="b1" />
                <span className="b2" />
              </div>
              <div className="flex flex-col items-start">
                <h1 className="k-wordmark">Kyrosaga</h1>
                <p className="k-sub">Multimodal Product Catalogue Intelligence System</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="k-seg" role="group" aria-label="Theme">
                <button
                  type="button"
                  className={`k-seg-btn ${theme === "cobalt" ? "on" : ""}`}
                  onClick={() => setTheme("cobalt")}
                  title="Cobalt theme"
                >
                  <MS name="water_drop" size={16} fill={theme === "cobalt"} />
                  Cobalt
                </button>
                <button
                  type="button"
                  className={`k-seg-btn ${theme === "lime" ? "on" : ""}`}
                  onClick={() => setTheme("lime")}
                  title="Lime theme"
                >
                  <MS name="eco" size={16} fill={theme === "lime"} />
                  Lime
                </button>
              </div>

              <div className="k-seg" role="group" aria-label="Mode">
                <button
                  type="button"
                  className={`k-seg-btn ${mode === "light" ? "on" : ""}`}
                  onClick={() => setMode("light")}
                  title="Light mode"
                  aria-label="Light mode"
                >
                  <MS name="light_mode" size={18} fill={mode === "light"} />
                </button>
                <button
                  type="button"
                  className={`k-seg-btn ${mode === "dark" ? "on" : ""}`}
                  onClick={() => setMode("dark")}
                  title="Dark mode"
                  aria-label="Dark mode"
                >
                  <MS name="dark_mode" size={18} fill={mode === "dark"} />
                </button>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingSearch(true) }}
            onDragLeave={(e) => { e.preventDefault(); setIsDraggingSearch(false) }}
            onDrop={handleSearchBarDrop}
            className={`k-hero-search ${isDraggingSearch ? "dragging" : ""}`}
          >
            <MS name="search" size={24} className="k-on-surface-variant" />
            {imagePreview && imageQuery && (
              <span className="k-img-attach" title={imageQuery.name}>
                <img src={imagePreview} alt="" />
                <span className="k-img-name">{imageQuery.name}</span>
                <button type="button" onClick={clearSearchImage} aria-label="Remove image query">
                  <MS name="close" size={16} />
                </button>
              </span>
            )}
            <input
              type="text"
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder={isDraggingSearch ? "Drop image to add a visual query" : "Describe what you are looking for (e.g. lightweight obsidian running shoes with grip)..."}
            />
            {textQuery && (
              <button
                type="button"
                className="k-hs-icon"
                onClick={() => setTextQuery("")}
                aria-label="Clear text query"
              >
                <MS name="close" size={20} />
              </button>
            )}
            <button
              type="button"
              className="k-hs-icon lens"
              onClick={() => searchFileRef.current?.click()}
              aria-label="Add image query"
              title="Add image query"
            >
              <MS name="image_search" size={22} />
            </button>
            <input
              ref={searchFileRef}
              type="file"
              accept="image/*"
              onChange={handleSearchImageChange}
              className="hidden"
            />
            <button type="submit" className="k-hs-submit" disabled={searchLoading}>
              {searchLoading ? (
                <>
                  <MS name="progress_activity" size={18} />
                  Computing...
                </>
              ) : (
                <>
                  <MS name="search" size={18} />
                  Execute Search
                </>
              )}
            </button>
          </form>

          <div className="k-filter-row" ref={filterRowRef}>
            <span className="k-eyebrow" style={{ marginRight: 4 }}>Pre-Filters</span>
            {filterChip("minStock", "Min stock", filterMinInventory, () => setFilterMinInventory(""), (
              <>
                <label>Minimum inventory</label>
                <input
                  type="number"
                  min="0"
                  value={filterMinInventory}
                  onChange={(e) => setFilterMinInventory(e.target.value)}
                  placeholder="0"
                  className="k-field k-field-dense"
                  autoFocus
                />
              </>
            ))}
            {filterChip("colour", "Colour", filterColour, () => setFilterColour(""), (
              <>
                <label>Colour</label>
                <input
                  type="text"
                  value={filterColour}
                  onChange={(e) => setFilterColour(e.target.value)}
                  placeholder="e.g. black"
                  className="k-field k-field-dense"
                  autoFocus
                />
              </>
            ))}
            {filterChip("style", "Style", filterStyle, () => setFilterStyle(""), (
              <>
                <label>Style</label>
                <input
                  type="text"
                  value={filterStyle}
                  onChange={(e) => setFilterStyle(e.target.value)}
                  placeholder="e.g. modern"
                  className="k-field k-field-dense"
                  autoFocus
                />
              </>
            ))}
            {filterChip("material", "Material", filterMaterial, () => setFilterMaterial(""), (
              <>
                <label>Material</label>
                <input
                  type="text"
                  value={filterMaterial}
                  onChange={(e) => setFilterMaterial(e.target.value)}
                  placeholder="e.g. leather"
                  className="k-field k-field-dense"
                  autoFocus
                />
              </>
            ))}
            {filterChip("shape", "Shape", filterShape, () => setFilterShape(""), (
              <>
                <label>Shape</label>
                <input
                  type="text"
                  value={filterShape}
                  onChange={(e) => setFilterShape(e.target.value)}
                  placeholder="e.g. polygon"
                  className="k-field k-field-dense"
                  autoFocus
                />
              </>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {searchError && <div className="k-banner-error mb-6">{searchError}</div>}

        <div className="space-y-4">
          {hasSearched && products.length > 0 && (
            <div className="flex justify-between items-center">
              <h2 className="k-section-title">
                Search Results ({products.length} Items)
              </h2>
              {products[0].similarity !== undefined && (
                <span className="text-xs k-on-surface-variant font-medium">
                  Sorted by similarity threshold ({imageQuery ? "60%+" : "48%+"})
                </span>
              )}
            </div>
          )}

          {!hasSearched ? (
            <div className="k-empty">
              <div className="k-empty-ic">
                <MS name="manage_search" size={28} />
              </div>
              <div>
                <h3 className="k-section-title">Catalog Search</h3>
                <p className="text-xs k-on-surface-variant mt-1 max-w-md mx-auto">
                  Enter a text query, drop an image onto the search bar, or pick an example below to begin.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {EXAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="k-example-chip"
                    onClick={() => handleExampleQuery(q)}
                  >
                    <MS name="auto_awesome" size={16} />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="k-empty">
              <div className="k-empty-ic">
                <MS name="search_off" size={28} />
              </div>
              <p className="text-sm k-on-surface-variant">
                No products found matching query metrics ({imageQuery ? "60%" : "48"}% match threshold).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={`k-product-card ${selectedProduct?.id === product.id ? "expanded" : ""}`}
                >
                  <div className="k-product-thumb">
                    <img src={product.image_url} alt={product.title} />
                    {product.similarity !== undefined && (
                      <div className="absolute top-3 right-3 k-match-badge">
                        {(product.similarity * 100).toFixed(1)}% Match
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <h3
                        className="k-on-surface flex-1 truncate"
                        style={{ font: "500 16px var(--md-sys-typescale-brand)", letterSpacing: "0.15px" }}
                      >
                        {product.title}
                      </h3>
                      <span
                        className="k-on-tertiary whitespace-nowrap"
                        style={{ font: "600 14px var(--md-sys-typescale-brand)" }}
                      >
                        ${product.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs k-on-surface-variant">
                      Stock availability: {product.inventory_count}
                    </div>
                    {product.extracted_attributes && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {product.extracted_attributes.colour && (
                          <span className="k-chip-tonal" style={{ maxWidth: "100%" }}>
                            <MS name="palette" size={13} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {product.extracted_attributes.colour.split(/[.,]/)[0]}
                            </span>
                          </span>
                        )}
                        {product.extracted_attributes.material_type && (
                          <span className="k-chip-tonal" style={{ maxWidth: "100%" }}>
                            <MS name="texture" size={13} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {product.extracted_attributes.material_type.split(/[.,]/)[0]}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="k-footer py-8 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-medium">Kyrosaga Catalog Intelligence</span>
          <span className="font-medium">System workspace assigned for Bish</span>
        </div>
      </footer>

      {selectedProduct && (
        <>
          <div className="k-detail-scrim" onClick={() => setSelectedProduct(null)} />
          <aside className="k-detail-panel" role="dialog" aria-label="Product details">
            <div className="k-detail-head">
              <h3>{selectedProduct.title}</h3>
              <button
                type="button"
                className="k-icon-btn"
                onClick={() => setSelectedProduct(null)}
                aria-label="Close details"
              >
                <MS name="close" size={22} />
              </button>
            </div>
            <div className="k-detail-body">
              <div className="k-detail-hero">
                <img src={selectedProduct.image_url} alt={selectedProduct.title} />
              </div>

              <div className="flex justify-between items-baseline mb-4">
                <span style={{ font: "600 20px var(--md-sys-typescale-brand)" }} className="k-on-tertiary">
                  ${selectedProduct.price.toFixed(2)}
                </span>
                <span className="text-xs k-on-surface-variant">
                  Stock availability: {selectedProduct.inventory_count}
                </span>
              </div>

              {selectedProduct.similarity !== undefined && (
                <div className="mb-4">
                  <span className="k-chip-primary">
                    <MS name="bolt" size={13} fill />
                    {(selectedProduct.similarity * 100).toFixed(1)}% Match
                  </span>
                </div>
              )}

              {selectedProduct.extracted_attributes && (
                <div className="mb-5">
                  <div className="k-eyebrow mb-1">Extracted Attributes</div>
                  {selectedProduct.extracted_attributes.colour && (
                    <div className="k-attr-row">
                      <span className="k-attr-label">Colour</span>
                      <span className="k-attr-value">{selectedProduct.extracted_attributes.colour}</span>
                    </div>
                  )}
                  {selectedProduct.extracted_attributes.style && (
                    <div className="k-attr-row">
                      <span className="k-attr-label">Style</span>
                      <span className="k-attr-value">{selectedProduct.extracted_attributes.style}</span>
                    </div>
                  )}
                  {selectedProduct.extracted_attributes.material_type && (
                    <div className="k-attr-row">
                      <span className="k-attr-label">Material</span>
                      <span className="k-attr-value">{selectedProduct.extracted_attributes.material_type}</span>
                    </div>
                  )}
                  {selectedProduct.extracted_attributes.shape && (
                    <div className="k-attr-row">
                      <span className="k-attr-label">Shape</span>
                      <span className="k-attr-value">{selectedProduct.extracted_attributes.shape}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedProduct.ai_description && (
                <div>
                  <div className="k-eyebrow mb-2">Generated Catalog Profile</div>
                  <div className="k-md-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedProduct.ai_description}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      <button
        type="button"
        className="k-fab"
        onClick={() => setUploadOpen(true)}
        aria-label="Add Product"
      >
        <MS name="add" size={22} />
        Add Product
      </button>

      {uploadOpen && (
        <div className="k-modal-scrim" onClick={closeUploadModal} role="dialog" aria-label="Catalog Ingestion Portal">
          <div className="k-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="k-modal-head">
              <h2>Catalog Ingestion Portal</h2>
              <button
                type="button"
                className="k-icon-btn"
                onClick={closeUploadModal}
                disabled={uploadLoading}
                aria-label="Close"
              >
                <MS name="close" size={22} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="upload-title" className="k-eyebrow block">
                    Product Title
                  </label>
                  <input
                    id="upload-title"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Enter product title..."
                    className="k-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="upload-price" className="k-eyebrow block">
                      Price
                    </label>
                    <input
                      id="upload-price"
                      type="number"
                      step="0.01"
                      value={uploadPrice}
                      onChange={(e) => setUploadPrice(e.target.value)}
                      placeholder="0.00"
                      className="k-field"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="upload-stock" className="k-eyebrow block">
                      Stock Level
                    </label>
                    <input
                      id="upload-stock"
                      type="number"
                      value={uploadStock}
                      onChange={(e) => setUploadStock(e.target.value)}
                      placeholder="0"
                      className="k-field"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="k-eyebrow block">Product Image Asset</span>
                {uploadImagePreview ? (
                  <div className="k-surface-flat p-4 flex flex-col items-center justify-center gap-4">
                    <img
                      src={uploadImagePreview}
                      alt="Upload preview"
                      className="max-h-60 object-contain"
                      style={{ borderRadius: "var(--md-sys-shape-medium)" }}
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => uploadFileRef.current?.click()}
                        className="k-btn-tonal"
                      >
                        <MS name="swap_horiz" size={18} />
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={() => { setUploadImage(null); setUploadImagePreview(null) }}
                        className="k-btn-danger"
                      >
                        <MS name="delete" size={16} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => uploadFileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingUpload(true) }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingUpload(false) }}
                    onDrop={handleUploadDrop}
                    className={`k-drop py-12 flex flex-col items-center justify-center gap-2 ${isDraggingUpload ? "active" : ""}`}
                  >
                    <MS name="cloud_upload" size={36} className="k-on-surface-variant" />
                    <span className="text-sm k-on-surface font-medium">
                      {isDraggingUpload ? "Drop product image here" : "Drag and drop or click to upload"}
                    </span>
                    <span className="text-xs k-on-surface-variant">Accepts image files up to 10MB</span>
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
                <div className="k-banner-pipeline space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="k-pipe-dot" />
                    <span className="text-xs font-semibold k-on-surface" style={{ letterSpacing: "0.5px" }}>
                      Agent Pipeline Executing
                    </span>
                  </div>
                  <p className="text-xs k-on-surface-variant k-mono leading-relaxed">{uploadStep}</p>
                </div>
              )}

              {uploadError && <div className="k-banner-error">{uploadError}</div>}

              {uploadSuccess && (
                <div className="k-banner-success space-y-4">
                  <div className="text-sm font-bold flex items-center gap-2">
                    <MS name="check_circle" size={18} fill />
                    Product Successfully Ingested by System
                  </div>

                  <div className="text-xs space-y-3 pt-3" style={{ borderTop: "1px solid color-mix(in oklab, currentColor 20%, transparent)" }}>
                    <div>
                      <span className="font-semibold block mb-2">Extracted Attributes:</span>
                      <div>
                        {uploadSuccess.colour && (
                          <div className="k-attr-row">
                            <span className="k-attr-label">Colour</span>
                            <span className="k-attr-value">{uploadSuccess.colour}</span>
                          </div>
                        )}
                        {uploadSuccess.style && (
                          <div className="k-attr-row">
                            <span className="k-attr-label">Style</span>
                            <span className="k-attr-value">{uploadSuccess.style}</span>
                          </div>
                        )}
                        {uploadSuccess.material_type && (
                          <div className="k-attr-row">
                            <span className="k-attr-label">Material</span>
                            <span className="k-attr-value">{uploadSuccess.material_type}</span>
                          </div>
                        )}
                        {uploadSuccess.shape && (
                          <div className="k-attr-row">
                            <span className="k-attr-label">Shape</span>
                            <span className="k-attr-value">{uploadSuccess.shape}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold block mb-1">Synthesized Description:</span>
                      <div className="k-md-prose">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{uploadSuccess.ai_description}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end k-divider pt-6">
                <button type="submit" disabled={uploadLoading} className="k-btn-filled">
                  {uploadLoading ? (
                    <>
                      <MS name="progress_activity" size={18} />
                      Processing Pipeline...
                    </>
                  ) : (
                    <>
                      <MS name="upload_file" size={18} />
                      Ingest Product
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
