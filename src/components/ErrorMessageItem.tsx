import IconRefresh from './icons/Refresh'
import type { ErrorMessage } from '@/types'

interface Props {
  data: ErrorMessage
  onRetry?: () => void
}

export default ({ data, onRetry }: Props) => {
  return (
    <div class="my-4 border border-red/50 bg-red/10 px-4 py-3">
      {data.code && <div class="mb-1 text-red">{data.code}</div>}
      <div class="text-sm text-red op-70">{data.message}</div>
      {onRetry && (
        <div class="mb-2 fie px-3">
          <div onClick={onRetry} class="border-red/50 text-red gpt-retry-btn">
            <IconRefresh />
            <span>重新生成</span>
          </div>
        </div>
      )}
    </div>
  )
}
