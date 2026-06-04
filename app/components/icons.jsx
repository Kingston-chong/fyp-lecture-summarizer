"use client";

/**
 * Centralized icons — MUI (@mui/icons-material) with stable export names.
 * Outlined variants keep a lighter look; a few bespoke SVGs kept where MUI has no match.
 */
import CircularProgress from "@mui/material/CircularProgress";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FullscreenExitOutlinedIcon from "@mui/icons-material/FullscreenExitOutlined";
import FullscreenOutlinedIcon from "@mui/icons-material/FullscreenOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SlideshowOutlinedIcon from "@mui/icons-material/SlideshowOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import UploadOutlinedIcon from "@mui/icons-material/UploadOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import BorderColorOutlinedIcon from "@mui/icons-material/BorderColorOutlined";
import UnfoldLessOutlinedIcon from "@mui/icons-material/UnfoldLessOutlined";
import ViewSidebarOutlinedIcon from "@mui/icons-material/ViewSidebarOutlined";

const FILE_TYPE_COLORS = {
  PDF: "#f87171",
  PPTX: "#fb923c",
  PPT: "#fb923c",
  DOCX: "#60a5fa",
  DOC: "#60a5fa",
  TXT: "#a3e635",
  MD: "#a3e635",
  XLSX: "#34d399",
  XLS: "#34d399",
  CSV: "#34d399",
  default: "#c084fc",
};

function fileColor(extOrType) {
  return FILE_TYPE_COLORS[extOrType?.toUpperCase()] || FILE_TYPE_COLORS.default;
}

function sx(size, extra = {}) {
  const n = Number(size);
  return {
    fontSize: Number.isFinite(n) ? n : size,
    display: "block",
    flexShrink: 0,
    ...extra,
  };
}

export const Chevron = ({ open }) => (
  <KeyboardArrowDownOutlinedIcon
    sx={sx(10, {
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform .2s",
    })}
    aria-hidden
  />
);

export const ChevRight = () => (
  <ChevronRightOutlinedIcon sx={sx(11)} aria-hidden />
);

export const CollapseAllIcon = ({ size = 16 }) => (
  <UnfoldLessOutlinedIcon sx={sx(size)} aria-hidden />
);

export const SidebarHideIcon = ({ size = 16 }) => (
  <ViewSidebarOutlinedIcon sx={sx(size)} aria-hidden />
);

export const DocIco = ({ ext, size = 12 }) => (
  <InsertDriveFileOutlinedIcon
    sx={sx(size, { color: fileColor(ext) })}
    aria-hidden
  />
);

export const QuizIco = () => <TaskAltOutlinedIcon sx={sx(14)} aria-hidden />;

export const FlashcardsIco = () => (
  <LibraryBooksOutlinedIcon sx={sx(14)} aria-hidden />
);

export const ManualCardsIco = () => (
  <PostAddOutlinedIcon sx={sx(14)} aria-hidden />
);

export const PdfIco = () => (
  <PictureAsPdfOutlinedIcon sx={sx(14)} aria-hidden />
);

export const SlidesIco = () => (
  <SlideshowOutlinedIcon sx={sx(14)} aria-hidden />
);

export const SendIco = () => <SendOutlinedIcon sx={sx(15)} aria-hidden />;

export const BotIco = () => <SmartToyOutlinedIcon sx={sx(13)} aria-hidden />;

export const UserIco = () => <PersonOutlinedIcon sx={sx(13)} aria-hidden />;

export const CopyIco = ({ size = 12 }) => (
  <ContentCopyOutlinedIcon sx={sx(size)} aria-hidden />
);

export const ReplyQuoteIco = ({ size = 14 }) => (
  <ReplyOutlinedIcon sx={sx(size)} aria-hidden />
);

export const RegenIco = ({ size = 12 }) => (
  <RefreshOutlinedIcon sx={sx(size)} aria-hidden />
);

export const HighlightIco = ({ size = 12 }) => (
  <BorderColorOutlinedIcon sx={sx(size)} aria-hidden />
);

export const SaveIco = ({ size = 14 }) => (
  <SaveOutlinedIcon sx={sx(size)} aria-hidden />
);

export const Spinner = ({ size = 14, color = "white" }) => (
  <CircularProgress
    size={size}
    thickness={5}
    sx={{ color, flexShrink: 0 }}
    aria-hidden
  />
);

export const CheckCircle = ({ met }) =>
  met ? (
    <CheckCircleOutlinedIcon sx={sx(13)} aria-hidden />
  ) : (
    <CheckCircleOutlineOutlinedIcon sx={sx(13)} aria-hidden />
  );

export const LogoIcon = () => <SlideshowOutlinedIcon sx={sx(18)} aria-hidden />;

export const MenuIcon = ({ size = 20 }) => (
  <MenuOutlinedIcon sx={sx(size)} aria-hidden />
);

export const SlidesIcon = () => (
  <SlideshowOutlinedIcon sx={sx(20)} aria-hidden />
);

export const UserCircleIcon = () => (
  <AccountCircleOutlinedIcon sx={sx(20)} aria-hidden />
);

export const ChevronDownIcon = ({ size = 11 }) => (
  <KeyboardArrowDownOutlinedIcon sx={sx(size)} aria-hidden />
);

export const UploadIcon = ({ size = 16 }) => (
  <UploadOutlinedIcon sx={sx(size)} aria-hidden />
);

export const ClipIco = ({ size = 16 }) => (
  <AttachFileOutlinedIcon sx={sx(size)} aria-hidden />
);

export const ImageIco = ({ size = 16 }) => (
  <ImageOutlinedIcon sx={sx(size)} aria-hidden />
);

export const FileIcon = ({ type, size = 26 }) => (
  <InsertDriveFileOutlinedIcon
    sx={sx(size, { color: fileColor(type) })}
    aria-hidden
  />
);

export const CloseIcon = ({ size = 12 }) => (
  <CloseOutlinedIcon sx={sx(size)} aria-hidden />
);

export const CheckIcon = ({ size = 16 }) => (
  <CheckOutlinedIcon sx={sx(size)} aria-hidden />
);

export const InfoIcon = ({ size = 16 }) => (
  <InfoOutlinedIcon sx={sx(size)} aria-hidden />
);

export const SparkleIcon = ({ size = 15 }) => (
  <AutoAwesomeOutlinedIcon sx={sx(size)} aria-hidden />
);

export const HistoryIcon = ({ size = 13 }) => (
  <HistoryOutlinedIcon sx={sx(size)} aria-hidden />
);

export const LogoutIcon = ({ size = 15 }) => (
  <LogoutOutlinedIcon sx={sx(size)} aria-hidden />
);

export const CopyIcon = ({ size = 13 }) => (
  <ContentCopyOutlinedIcon sx={sx(size)} aria-hidden />
);

export const EyeOffIcon = ({ size = 15 }) => (
  <VisibilityOffOutlinedIcon sx={sx(size)} aria-hidden />
);

export const EyeIcon = ({ size = 15 }) => (
  <VisibilityOutlinedIcon sx={sx(size)} aria-hidden />
);

export const ShieldIcon = ({ size = 24 }) => (
  <ShieldOutlinedIcon sx={sx(size)} aria-hidden />
);

export const LockIcon = ({ size = 24 }) => (
  <LockOutlinedIcon sx={sx(size)} aria-hidden />
);

export const MailIcon = ({ size = 24 }) => (
  <MailOutlineOutlinedIcon sx={sx(size)} aria-hidden />
);

/** Google sign-in brand colors (not available as a single MUI outlined icon). */
export const GoogleIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <path
      d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      fill="#EA4335"
    />
  </svg>
);

export const ActionsMenuIco = ({ size = 14 }) => (
  <AppsOutlinedIcon sx={sx(size)} aria-hidden />
);

export const DotsIcon = ({ size = 14 }) => (
  <MoreHorizOutlinedIcon sx={sx(size)} aria-hidden />
);

export const PinIcon = ({ size = 14, filled = false }) =>
  filled ? (
    <PushPinIcon sx={sx(size)} aria-hidden />
  ) : (
    <PushPinOutlinedIcon sx={sx(size)} aria-hidden />
  );

export const ShareIcon = ({ size = 16 }) => (
  <ShareOutlinedIcon sx={sx(size)} aria-hidden />
);

export const EditIcon = ({ size = 16 }) => (
  <EditOutlinedIcon sx={sx(size)} aria-hidden />
);

export const TrashIcon = ({ size = 16 }) => (
  <DeleteOutlineOutlinedIcon sx={sx(size)} aria-hidden />
);

export const ArrowLeftIcon = ({ size = 16 }) => (
  <ArrowBackOutlinedIcon sx={sx(size)} aria-hidden />
);

export const ReadFocusIcon = ({ size = 14 }) => (
  <FullscreenOutlinedIcon sx={sx(size)} aria-hidden />
);

export const ReadFocusExitIcon = ({ size = 14 }) => (
  <FullscreenExitOutlinedIcon sx={sx(size)} aria-hidden />
);
