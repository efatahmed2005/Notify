package com.example.notify.ui.adapter;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.util.DisplayMetrics;
import android.util.Log;
import android.util.LruCache;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.notify.R;

/**
 * High-performance, synchronized RecyclerView Adapter for rendering multi-page PDFs continuously.
 * Uses native PdfRenderer with memory-efficient LruCache for smooth, 60fps scrolling across all pages.
 */
public class PdfPagesAdapter extends RecyclerView.Adapter<PdfPagesAdapter.PdfPageViewHolder> {

    private static final String TAG = "PdfPagesAdapter";

    private final Context context;
    private final PdfRenderer pdfRenderer;
    private final int pageCount;
    private final LruCache<Integer, Bitmap> pageBitmapCache;
    private final int targetRenderWidth;

    public PdfPagesAdapter(Context context, PdfRenderer pdfRenderer) {
        this.context = context;
        this.pdfRenderer = pdfRenderer;
        this.pageCount = (pdfRenderer != null) ? pdfRenderer.getPageCount() : 0;

        // Allocate up to 1/8th of available runtime memory for page bitmaps
        int maxMemoryKb = (int) (Runtime.getRuntime().maxMemory() / 1024);
        int cacheSizeKb = Math.max(maxMemoryKb / 8, 8192); // Minimum 8MB cache
        this.pageBitmapCache = new LruCache<Integer, Bitmap>(cacheSizeKb) {
            @Override
            protected int sizeOf(Integer key, Bitmap bitmap) {
                return bitmap.getByteCount() / 1024;
            }
        };

        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        // High-density scaling for crisp text rendering
        this.targetRenderWidth = Math.min((int) (dm.widthPixels * 1.5f), 2048);
    }

    @NonNull
    @Override
    public PdfPageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_pdf_page, parent, false);
        return new PdfPageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull PdfPageViewHolder holder, int position) {
        holder.tvPageBadge.setText("Page " + (position + 1) + " of " + pageCount);

        // Check if bitmap is already in LRU cache
        Bitmap cachedBitmap = pageBitmapCache.get(position);
        if (cachedBitmap != null && !cachedBitmap.isRecycled()) {
            holder.ivPageBitmap.setImageBitmap(cachedBitmap);
            return;
        }

        // Render page with synchronized thread safety (PdfRenderer allows only 1 open page at a time)
        Bitmap rendered = renderPageSynchronously(position);
        if (rendered != null) {
            pageBitmapCache.put(position, rendered);
            holder.ivPageBitmap.setImageBitmap(rendered);
        }
    }

    /**
     * Safely opens, renders, and closes a single PDF page with crisp scaling.
     */
    private synchronized Bitmap renderPageSynchronously(int pageIndex) {
        if (pdfRenderer == null || pageIndex < 0 || pageIndex >= pageCount) {
            return null;
        }

        PdfRenderer.Page page = null;
        try {
            page = pdfRenderer.openPage(pageIndex);

            float scale = (float) targetRenderWidth / (float) page.getWidth();
            int targetHeight = (int) (page.getHeight() * scale);

            // Memory guard
            if (targetHeight > 4096) {
                targetHeight = 4096;
            }

            Bitmap bitmap = Bitmap.createBitmap(targetRenderWidth, targetHeight, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);

            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
            return bitmap;
        } catch (Exception e) {
            Log.e(TAG, "Failed to render PDF page " + pageIndex, e);
            return null;
        } finally {
            if (page != null) {
                try {
                    page.close();
                } catch (Exception ignored) {}
            }
        }
    }

    @Override
    public int getItemCount() {
        return pageCount;
    }

    public void clearCache() {
        pageBitmapCache.evictAll();
    }

    static class PdfPageViewHolder extends RecyclerView.ViewHolder {
        ImageView ivPageBitmap;
        TextView tvPageBadge;

        public PdfPageViewHolder(@NonNull View itemView) {
            super(itemView);
            ivPageBitmap = itemView.findViewById(R.id.ivPageBitmap);
            tvPageBadge = itemView.findViewById(R.id.tvPageBadge);
        }
    }
}
