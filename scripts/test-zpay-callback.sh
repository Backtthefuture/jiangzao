#!/bin/bash

# ============================================================================
# Z-Pay 支付回调测试脚本
# ============================================================================
#
# 功能: 模拟 Z-Pay 发送支付成功回调到你的服务器
#
# 使用方法:
#   1. 修改配置部分的变量（CALLBACK_URL, OUT_TRADE_NO 等）
#   2. 赋予执行权限: chmod +x test-zpay-callback.sh
#   3. 运行脚本: ./test-zpay-callback.sh
#
# 前提条件:
#   - 安装了 curl
#   - 安装了 md5sum (Linux) 或 md5 (Mac)
#
# ============================================================================

set -e  # 遇到错误立即退出

# ============================================================================
# 配置部分 - 请根据实际情况修改
# ============================================================================

# 回调地址（根据部署环境修改）
# 本地测试: http://localhost:3000/api/payment/callback
# Vercel 部署: https://your-domain.vercel.app/api/payment/callback
CALLBACK_URL="http://localhost:3000/api/payment/callback"

# Z-Pay 配置（从 .env.local 复制）
ZPAY_PID="2025062920440492"
ZPAY_KEY="tNeFjVxC3b8IlgNJvqFA9oRNxy9ShaA1"

# 订单信息（从 Supabase orders 表中获取实际的 pending 订单）
OUT_TRADE_NO="JZ_20251104_1730720000000_A1B2C3"  # 商户订单号（必须改为实际值）
TRADE_NO="20241104123456789"                       # Z-Pay 交易号（可随机生成）
MONEY="9.90"                                        # 订单金额（必须与 orders 表一致）
NAME="降噪平台月会员"                               # 商品名称
TYPE="wxpay"                                        # 支付方式: wxpay 或 alipay
TRADE_STATUS="TRADE_SUCCESS"                        # 交易状态

# ============================================================================
# 颜色输出
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 函数定义
# ============================================================================

# 打印标题
print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   Z-Pay 支付回调测试脚本${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

# 打印配置信息
print_config() {
    echo -e "${YELLOW}📋 配置信息:${NC}"
    echo "  回调地址: $CALLBACK_URL"
    echo "  商户ID: $ZPAY_PID"
    echo "  订单号: $OUT_TRADE_NO"
    echo "  交易号: $TRADE_NO"
    echo "  金额: ¥$MONEY"
    echo "  商品名称: $NAME"
    echo "  支付方式: $TYPE"
    echo "  交易状态: $TRADE_STATUS"
    echo ""
}

# 生成 MD5 签名
generate_sign() {
    # 按字母顺序排序参数（排除 sign 和 sign_type）
    SIGN_STR="money=${MONEY}&name=${NAME}&out_trade_no=${OUT_TRADE_NO}&pid=${ZPAY_PID}&trade_no=${TRADE_NO}&trade_status=${TRADE_STATUS}&type=${TYPE}${ZPAY_KEY}"

    echo -e "${YELLOW}🔐 签名计算:${NC}"
    echo "  原始字符串: $SIGN_STR"

    # 根据操作系统选择 MD5 工具
    if command -v md5sum &> /dev/null; then
        SIGN=$(echo -n "$SIGN_STR" | md5sum | awk '{print $1}')
    elif command -v md5 &> /dev/null; then
        SIGN=$(echo -n "$SIGN_STR" | md5 | awk '{print $1}')
    else
        echo -e "${RED}❌ 错误: 未找到 md5 或 md5sum 工具${NC}"
        echo "  macOS: 系统自带 md5 工具"
        echo "  Linux: 安装 md5sum 工具"
        exit 1
    fi

    echo "  MD5 签名: $SIGN"
    echo ""
}

# 测试 GET 请求
test_get_request() {
    echo -e "${GREEN}🚀 测试 1: GET 请求${NC}"
    echo "  方法: GET"
    echo "  URL: ${CALLBACK_URL}?..."
    echo ""

    # 构造 URL
    URL="${CALLBACK_URL}?pid=${ZPAY_PID}&trade_no=${TRADE_NO}&out_trade_no=${OUT_TRADE_NO}&type=${TYPE}&name=${NAME}&money=${MONEY}&trade_status=${TRADE_STATUS}&sign=${SIGN}&sign_type=MD5"

    # 发送请求
    echo -e "${BLUE}📤 发送请求...${NC}"
    RESPONSE=$(curl -s -w "\n\nHTTP_STATUS:%{http_code}" -X GET "$URL")

    # 解析响应
    HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
    HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

    echo -e "${BLUE}📥 响应:${NC}"
    echo "  HTTP 状态码: $HTTP_STATUS"
    echo "  响应内容: $HTTP_BODY"
    echo ""

    # 验证响应
    if [[ "$HTTP_STATUS" == "200" ]] && [[ "$HTTP_BODY" == *"success"* ]]; then
        echo -e "${GREEN}✅ GET 请求测试成功！${NC}"
        return 0
    else
        echo -e "${RED}❌ GET 请求测试失败！${NC}"
        if [[ "$HTTP_STATUS" == "405" ]]; then
            echo -e "${RED}  → 服务器不支持 GET 请求（需要修复代码）${NC}"
        elif [[ "$HTTP_STATUS" == "403" ]]; then
            echo -e "${RED}  → 签名验证失败或商户ID不匹配${NC}"
        elif [[ "$HTTP_STATUS" == "404" ]]; then
            echo -e "${RED}  → 订单不存在${NC}"
        elif [[ "$HTTP_STATUS" == "500" ]]; then
            echo -e "${RED}  → 服务器内部错误${NC}"
        fi
        return 1
    fi
}

# 测试 POST 请求
test_post_request() {
    echo ""
    echo -e "${GREEN}🚀 测试 2: POST 请求 (application/x-www-form-urlencoded)${NC}"
    echo "  方法: POST"
    echo "  URL: $CALLBACK_URL"
    echo ""

    # 发送请求
    echo -e "${BLUE}📤 发送请求...${NC}"
    RESPONSE=$(curl -s -w "\n\nHTTP_STATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "pid=${ZPAY_PID}" \
        -d "trade_no=${TRADE_NO}" \
        -d "out_trade_no=${OUT_TRADE_NO}" \
        -d "type=${TYPE}" \
        -d "name=${NAME}" \
        -d "money=${MONEY}" \
        -d "trade_status=${TRADE_STATUS}" \
        -d "sign=${SIGN}" \
        -d "sign_type=MD5" \
        "$CALLBACK_URL")

    # 解析响应
    HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
    HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

    echo -e "${BLUE}📥 响应:${NC}"
    echo "  HTTP 状态码: $HTTP_STATUS"
    echo "  响应内容: $HTTP_BODY"
    echo ""

    # 验证响应
    if [[ "$HTTP_STATUS" == "200" ]] && [[ "$HTTP_BODY" == *"success"* ]]; then
        echo -e "${GREEN}✅ POST 请求测试成功！${NC}"
        return 0
    else
        echo -e "${RED}❌ POST 请求测试失败！${NC}"
        if [[ "$HTTP_STATUS" == "405" ]]; then
            echo -e "${RED}  → 服务器不支持 POST 请求${NC}"
        elif [[ "$HTTP_STATUS" == "403" ]]; then
            echo -e "${RED}  → 签名验证失败或商户ID不匹配${NC}"
        elif [[ "$HTTP_STATUS" == "404" ]]; then
            echo -e "${RED}  → 订单不存在${NC}"
        elif [[ "$HTTP_STATUS" == "500" ]]; then
            echo -e "${RED}  → 服务器内部错误${NC}"
        fi
        return 1
    fi
}

# 打印总结
print_summary() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   测试总结${NC}"
    echo -e "${BLUE}================================================${NC}"

    if [[ $GET_SUCCESS == true ]] && [[ $POST_SUCCESS == true ]]; then
        echo -e "${GREEN}✅ 所有测试通过！回调接口工作正常${NC}"
        echo ""
        echo -e "${GREEN}🎉 下一步:${NC}"
        echo "  1. 在 Z-Pay 商户后台手动重新通知现有订单"
        echo "  2. 或发起一笔新的测试支付（建议 ¥0.01）"
        echo "  3. 检查 Supabase orders 表订单状态是否更新为 completed"
        echo ""
    elif [[ $GET_SUCCESS == true ]] && [[ $POST_SUCCESS == false ]]; then
        echo -e "${YELLOW}⚠️  GET 测试通过，POST 测试失败${NC}"
        echo "  → Z-Pay 使用 GET 请求，所以不影响实际回调"
        echo "  → 建议：修复 POST 处理以提高兼容性"
        echo ""
    elif [[ $GET_SUCCESS == false ]]; then
        echo -e "${RED}❌ GET 测试失败！这是关键问题！${NC}"
        echo ""
        echo -e "${RED}🔧 排查建议:${NC}"
        echo "  1. 检查 CALLBACK_URL 是否正确"
        echo "  2. 检查 OUT_TRADE_NO 是否存在于 orders 表"
        echo "  3. 检查 MONEY 金额是否与订单金额一致"
        echo "  4. 检查 ZPAY_KEY 是否正确"
        echo "  5. 查看服务器日志获取详细错误信息"
        echo ""
        echo -e "${RED}📋 详细排查步骤:${NC}"
        echo "  → 参考 ZPAY_CALLBACK_FIX.md 文档"
        echo ""
    fi
}

# ============================================================================
# 主程序
# ============================================================================

main() {
    # 打印标题
    print_header

    # 打印配置
    print_config

    # 生成签名
    generate_sign

    # 测试 GET 请求
    if test_get_request; then
        GET_SUCCESS=true
    else
        GET_SUCCESS=false
    fi

    # 测试 POST 请求
    if test_post_request; then
        POST_SUCCESS=true
    else
        POST_SUCCESS=false
    fi

    # 打印总结
    print_summary

    # 返回退出码
    if [[ $GET_SUCCESS == true ]]; then
        exit 0
    else
        exit 1
    fi
}

# 运行主程序
main
