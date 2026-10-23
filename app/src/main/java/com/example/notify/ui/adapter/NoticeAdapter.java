package com.example.notify.ui.adapter;

import android.content.Context;
import android.content.Intent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.notify.R;
import com.example.notify.data.model.Notice;
import com.example.notify.ui.details.NoticeDetailsActivity;
import com.example.notify.utils.DateUtils;
import com.example.notify.utils.UiHelper;
import java.util.ArrayList;
import java.util.List;

public class NoticeAdapter extends RecyclerView.Adapter<NoticeAdapter.NoticeViewHolder> {

    public interface OnNoticeClickListener {
        void onNoticeClick(Notice notice);
    }

    private final Context context;
    private final List<Notice> noticeList = new ArrayList<>();
    private OnNoticeClickListener clickListener;

    public NoticeAdapter(Context context) {
        this.context = context;
    }

    public void setOnNoticeClickListener(OnNoticeClickListener listener) {
        this.clickListener = listener;
    }

    public void setNotices(List<Notice> notices) {
        this.noticeList.clear();
        if (notices != null) {
            this.noticeList.addAll(notices);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public NoticeViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_notice_card, parent, false);
        return new NoticeViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull NoticeViewHolder holder, int position) {
        Notice notice = noticeList.get(position);

        holder.tvTitle.setText(notice.getTitle());
        holder.tvContent.setText(notice.getContent());
        holder.tvPublisher.setText(notice.getPublisherName());
        holder.tvTimestamp.setText(DateUtils.getRelativeTimeSpanString(notice.getTimestamp()));
        holder.tvAudience.setText(notice.getTargetAudience() + " - " + notice.getPublicationStatus());

        // Category Badge
        holder.tvCategoryBadge.setText(UiHelper.getCategoryLabel(notice.getCategory()));
        holder.tvCategoryBadge.setBackgroundResource(UiHelper.getCategoryBadgeBackground(notice.getCategory()));
        holder.tvCategoryBadge.setTextColor(UiHelper.getCategoryTextColor(context, notice.getCategory()));

        // Department Badge
        String deptText = "ALL".equalsIgnoreCase(notice.getTargetDepartment()) ? "Campus" : notice.getTargetAudience();
        holder.tvDeptBadge.setText(deptText);

        // Attachment View
        if (notice.hasAttachment()) {
            holder.layoutAttachmentPreview.setVisibility(View.VISIBLE);
            holder.tvAttachmentName.setText(notice.getAttachmentName());
            String sizeText = (notice.getAttachmentSize() != null ? notice.getAttachmentSize() : "Document") + " • Tap to open";
            holder.tvAttachmentSize.setText(sizeText);

            View.OnClickListener openAttachment = v -> {
                Intent docIntent = new Intent(context, com.example.notify.ui.details.DocumentPreviewActivity.class);
                docIntent.putExtra("notice", notice);
                context.startActivity(docIntent);
            };
            holder.layoutAttachmentPreview.setOnClickListener(openAttachment);
            holder.btnViewAttachment.setOnClickListener(openAttachment);
        } else {
            holder.layoutAttachmentPreview.setVisibility(View.GONE);
        }

        // Click on whole card
        holder.itemView.setOnClickListener(v -> {
            if (clickListener != null) {
                clickListener.onNoticeClick(notice);
            } else {
                Intent intent = new Intent(context, NoticeDetailsActivity.class);
                intent.putExtra("notice", notice);
                context.startActivity(intent);
            }
        });

        // Copy button
        holder.btnCopy.setOnClickListener(v -> UiHelper.copyNoticeToClipboard(context, notice));

        // Share button
        holder.btnShare.setOnClickListener(v -> UiHelper.shareNotice(context, notice));
    }

    @Override
    public int getItemCount() {
        return noticeList.size();
    }

    static class NoticeViewHolder extends RecyclerView.ViewHolder {
        TextView tvCategoryBadge, tvDeptBadge, tvTimestamp, tvTitle, tvContent, tvPublisher, tvAudience;
        View layoutAttachmentPreview;
        TextView tvAttachmentName, tvAttachmentSize, btnViewAttachment;
        ImageButton btnCopy, btnShare;

        public NoticeViewHolder(@NonNull View itemView) {
            super(itemView);
            tvCategoryBadge = itemView.findViewById(R.id.tvCategoryBadge);
            tvDeptBadge = itemView.findViewById(R.id.tvDeptBadge);
            tvTimestamp = itemView.findViewById(R.id.tvTimestamp);
            tvTitle = itemView.findViewById(R.id.tvTitle);
            tvContent = itemView.findViewById(R.id.tvContent);
            tvPublisher = itemView.findViewById(R.id.tvPublisher);
            tvAudience = itemView.findViewById(R.id.tvAudience);

            layoutAttachmentPreview = itemView.findViewById(R.id.layoutAttachmentPreview);
            tvAttachmentName = itemView.findViewById(R.id.tvAttachmentName);
            tvAttachmentSize = itemView.findViewById(R.id.tvAttachmentSize);
            btnViewAttachment = itemView.findViewById(R.id.btnViewAttachment);

            btnCopy = itemView.findViewById(R.id.btnCopy);
            btnShare = itemView.findViewById(R.id.btnShare);
        }
    }
}
