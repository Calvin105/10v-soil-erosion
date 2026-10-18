import { CompassIcon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function NotFound({ what = "page" }: { what?: string }) {
  return (
    <div className="mx-auto max-w-xl p-8">
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CompassIcon />
          </EmptyMedia>
          <EmptyTitle>That {what} is not on the map</EmptyTitle>
          <EmptyDescription>Every order starts at the township. Go back to the top and drill down.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/b">Back to City of Elmina</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
