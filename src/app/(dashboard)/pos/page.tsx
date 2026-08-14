import { prisma } from "@/lib/prisma"
import { POSContainer } from "@/components/pos/pos-container"
import { getAuthStaff } from "@/lib/auth-helper"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function POSPage() {
  const { staff: dbStaff } = await getAuthStaff()

  if (!dbStaff) {
    redirect("/sign-in")
  }

  const initialStaff = dbStaff
    ? {
        id: dbStaff.id,
        name: dbStaff.name,
        email: dbStaff.email,
        role: dbStaff.role,
        branchId: dbStaff.branchId,
        branchName: dbStaff.branch.name,
      }
    : null

  // Fetch branches, categories, and products with variants, addons, and stock levels
  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
  })

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  })

  const products = await prisma.product.findMany({
    where: { 
      isActive: true,
    },
    include: {
      variants: {
        include: {
          stockLevels: {
            select: {
              branchId: true,
              quantity: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return (
    <POSContainer
      initialBranches={branches}
      initialCategories={categories}
      initialProducts={products}
      initialStaff={initialStaff}
    />
  )
}
