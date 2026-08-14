import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml"
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WEBP, GIF, and SVG images are allowed." },
        { status: 400 }
      )
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit." }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Path to public/uploads/products
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products")
    await mkdir(uploadDir, { recursive: true })

    const ext = path.extname(file.name) || ".png"
    const sanitizeExt = ext.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase()
    const filename = `product-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${sanitizeExt || ".png"}`
    const filePath = path.join(uploadDir, filename)

    await writeFile(filePath, buffer)

    const relativeUrl = `/uploads/products/${filename}`
    return NextResponse.json({ url: relativeUrl, filename }, { status: 201 })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to upload file." }, { status: 500 })
  }
}
