#!/bin/bash

# 部署脚本 - 用于管理 aistudy-backend 服务
# 使用方法: ./deploy.sh {start|stop|restart|status|logs}

# 配置
APP_NAME="ai_course"
APP_PATH="/data/ai_course/backend"
APP_BIN="$APP_PATH/$APP_NAME"
PID_FILE="$APP_PATH/$APP_NAME.pid"
LOG_FILE="$APP_PATH/$APP_NAME.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查应用是否存在
check_app() {
    if [ ! -f "$APP_BIN" ]; then
        print_error "应用文件不存在: $APP_BIN"
        exit 1
    fi
    
    # 确保可执行
    chmod +x "$APP_BIN"
}

# 检查是否已经在运行
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0 # 正在运行
        fi
    fi
    return 1 # 未运行
}

# 获取PID
get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

# 启动应用
start() {
    print_info "正在启动 $APP_NAME..."
    
    if is_running; then
        PID=$(get_pid)
        print_warn "$APP_NAME 已经在运行中, PID: $PID"
        return 0
    fi
    
    check_app
    
    cd "$APP_PATH"
    
    # 启动应用，将输出重定向到日志文件
    nohup "$APP_BIN" >> "$LOG_FILE" 2>&1 &
    NEW_PID=$!
    
    # 保存PID
    echo $NEW_PID > "$PID_FILE"
    
    # 等待一下检查是否启动成功
    sleep 2
    
    if is_running; then
        print_info "$APP_NAME 启动成功, PID: $NEW_PID"
        
        # 显示启动日志
        echo ""
        print_info "最近的日志:"
        tail -n 5 "$LOG_FILE"
    else
        print_error "$APP_NAME 启动失败，请检查日志: $LOG_FILE"
        exit 1
    fi
}

# 停止应用
stop() {
    print_info "正在停止 $APP_NAME..."
    
    if ! is_running; then
        print_warn "$APP_NAME 没有在运行"
        return 0
    fi
    
    PID=$(get_pid)
    print_info "正在停止进程 PID: $PID"
    
    # 优雅停止
    kill -15 "$PID" > /dev/null 2>&1
    
    # 等待进程结束
    local MAX_WAIT=10
    local WAIT_COUNT=0
    
    while is_running && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        sleep 1
        WAIT_COUNT=$((WAIT_COUNT + 1))
        echo -n "."
    done
    
    echo ""
    
    if is_running; then
        print_warn "进程没有响应优雅停止，强制终止..."
        kill -9 "$PID" > /dev/null 2>&1
        sleep 1
    fi
    
    if ! is_running; then
        rm -f "$PID_FILE"
        print_info "$APP_NAME 已停止"
    else
        print_error "无法停止 $APP_NAME"
        exit 1
    fi
}

# 重启应用
restart() {
    print_info "正在重启 $APP_NAME..."
    stop
    sleep 2
    start
}

# 查看状态
status() {
    if is_running; then
        PID=$(get_pid)
        print_info "$APP_NAME 正在运行, PID: $PID"
        
        # 显示进程信息
        echo ""
        ps -f -p "$PID"
        
        # 显示最近日志
        echo ""
        print_info "最近的日志:"
        tail -n 5 "$LOG_FILE"
    else
        print_warn "$APP_NAME 没有在运行"
    fi
}

# 查看日志
logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        print_error "日志文件不存在: $LOG_FILE"
        exit 1
    fi
}

# 主函数
main() {
    case "$1" in
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        status)
            status
            ;;
        logs)
            logs
            ;;
        *)
            echo "使用方法: $0 {start|stop|restart|status|logs}"
            echo ""
            echo "  start   - 启动 $APP_NAME"
            echo "  stop    - 停止 $APP_NAME"
            echo "  restart - 重启 $APP_NAME"
            echo "  status  - 查看 $APP_NAME 状态"
            echo "  logs    - 查看 $APP_NAME 日志"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"