#!/usr/bin/env python3
"""
Cloudflare Stats Query Tool

This tool replaces the bash script with Python implementation for more flexible Cloudflare API handling.
"""

import os
import json
import requests
from datetime import datetime, timedelta
import argparse

# Configuration - load from .env file or environment variables

def load_env_file():
    """Load environment variables from .env file"""
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip().strip('"')

# Load environment variables from .env file
load_env_file()

# Configuration - load from environment variables or use defaults
AUTH_EMAIL = os.getenv('CLOUDFLARE_AUTH_EMAIL', '')
AUTH_KEY = os.getenv('CLOUDFLARE_API_KEY', '')
ZONE_ID = os.getenv('CLOUDFLARE_ZONE_ID', '')

def get_yesterday_and_today():
    """Get yesterday and today in ISO format"""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    return yesterday.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')

def query_graphql_api(query, variables=None):
    """Query Cloudflare GraphQL API"""
    url = "https://api.cloudflare.com/client/v4/graphql"
    headers = {
        "X-Auth-Email": AUTH_EMAIL,
        "X-Auth-Key": AUTH_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "query": query
    }
    
    if variables:
        payload["variables"] = variables
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error querying GraphQL API: {e}")
        return None

def get_basic_stats(yesterday, today):
    """Get basic statistics for the zone"""
    query = """
    query($zoneTag: String!, $yesterday: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(limit: 1, filter: { date: $yesterday }) {
            sum {
              pageViews
              requests
            }
          }
        }
      }
    }
    """
    
    variables = {
        "zoneTag": ZONE_ID,
        "yesterday": yesterday
    }
    
    return query_graphql_api(query, variables)

def get_hourly_stats(yesterday, today):
    """Get hourly statistics for the zone"""
    query = """
    query($zoneTag: String!, $yesterday: String!, $today: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1hGroups(limit: 24, filter: { datetime_geq: $yesterday, datetime_lt: $today }) {
            dimensions {
              datetime
            }
            sum {
              pageViews
              requests
            }
          }
        }
      }
    }
    """
    
    variables = {
        "zoneTag": ZONE_ID,
        "yesterday": f"{yesterday}T00:00:00Z",
        "today": f"{today}T00:00:00Z"
    }
    
    return query_graphql_api(query, variables)

def get_single_page_details(yesterday, today, target_path):
    """获取指定页面的访问明细"""
    query = """
    query GetPageDetails($zoneTag: String!, $start: datetime!, $end: datetime!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 1000,
            filter: {
              datetime_geq: $start,
              datetime_leq: $end
            },
            orderBy: [datetime_DESC]
          ) {
            dimensions {
              datetime
              clientRequestPath
              userAgent
              clientIP
            }
          }
        }
      }
    }
    """
    
    variables = {
        "zoneTag": ZONE_ID,
        "start": f"{yesterday}T00:00:00Z",
        "end": f"{today}T00:00:00Z"
    }
    
    result = query_graphql_api(query, variables)
    
    # 过滤出指定页面的访问记录
    filtered_logs = []
    if result and result.get('data'):
        groups = result['data']['viewer']['zones'][0]['httpRequestsAdaptiveGroups']
        for item in groups:
            dimensions = item['dimensions']
            if dimensions['clientRequestPath'] == target_path:
                filtered_logs.append(item)
    
    # 将过滤后的结果结构调整为与API返回一致的格式
    return {
        'data': {
            'viewer': {
                'zones': [{
                    'httpRequestsAdaptiveGroups': filtered_logs
                }]
            }
        }
    } if filtered_logs else None


def get_ip_activity(yesterday, today, target_ip):
    """查询特定 IP 的所有访问路径"""
    # 由于Cloudflare Free计划的限制，我们需要先获取所有记录，然后在Python中过滤
    query = """
    query GetIPActivity($zoneTag: String!, $start: datetime!, $end: datetime!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 1000,
            filter: {
              datetime_geq: $start,
              datetime_leq: $end
            },
            orderBy: [datetime_DESC]
          ) {
            dimensions {
              datetime
              clientRequestPath
              userAgent
              clientIP
            }
          }
        }
      }
    }
    """
    
    variables = {
        "zoneTag": ZONE_ID,
        "start": f"{yesterday}T00:00:00Z",
        "end": f"{today}T00:00:00Z"
    }
    
    result = query_graphql_api(query, variables)
    
    # 过滤出特定IP的访问记录
    ip_activity = []
    if result and result.get('data'):
        groups = result['data']['viewer']['zones'][0]['httpRequestsAdaptiveGroups']
        for item in groups:
            dimensions = item['dimensions']
            if dimensions.get('clientIP') == target_ip:
                ip_activity.append(item)
    
    return ip_activity


def get_page_stats(yesterday, today):
    """Get detailed page statistics using httpRequestsAdaptiveGroups, close to raw logs"""
    # Modified query to get more detailed information resembling raw logs
    query = """
    query GetDetailedLogs($zoneTag: String!, $start: datetime!, $end: datetime!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 1000,
            filter: {
              datetime_geq: $start,
              datetime_leq: $end
            },
            orderBy: [datetime_DESC]
          ) {
            dimensions {
              datetime
              clientRequestPath
              userAgent
              clientIP
            }
          }
        }
      }
    }
    """
    
    variables = {
        "zoneTag": ZONE_ID,
        "start": f"{yesterday}T00:00:00Z",
        "end": f"{today}T00:00:00Z"
    }
    
    result = query_graphql_api(query, variables)
    
    # Filter and process the results to get only case paths
    if result and result.get('data'):
        hot_cases = []
        detailed_logs = []
        groups = result['data']['viewer']['zones'][0]['httpRequestsAdaptiveGroups']
        
        for item in groups:
            dimensions = item['dimensions']
            sum_data = {}  # No sum data available in Free plan
            path = dimensions['clientRequestPath']
            
            # Store detailed logs for all requests (raw log-like data)
            detailed_logs.append({
                "datetime": dimensions['datetime'],
                "path": path,
                "userAgent": dimensions['userAgent'],
                "clientIP": dimensions['clientIP'],
                "pageViews": 1  # Default to 1 per entry since no sum data available
            })
            
            # Filter: only keep case paths for hot cases
            if "/case/" in path or path.endswith(".html"):
                hot_cases.append({
                    "path": path,
                    "views": 1,  # Default to 1 per entry since no sum data available
                    "datetime": dimensions['datetime'],
                    "clientIP": dimensions['clientIP']
                })
        
        # Save detailed logs to a separate file (raw log-like format)
        save_to_file(detailed_logs, f"detailed-logs-{yesterday}.json")
        
        # If we have cases, try to aggregate them by path for hot cases
        if hot_cases:
            # Create a dictionary to aggregate views by path
            path_counts = {}
            for case in hot_cases:
                if case['path'] in path_counts:
                    path_counts[case['path']] += case['views']
                else:
                    path_counts[case['path']] = case['views']
            
            # Convert back to list format
            aggregated_hot_cases = [
                {"path": path, "views": views} for path, views in path_counts.items()
            ]
            
            # Sort by views in descending order
            aggregated_hot_cases.sort(key=lambda x: x['views'], reverse=True)
            
            # Save the filtered and aggregated hot cases to a separate file for SEO purposes
            save_to_file(aggregated_hot_cases, f"top_hits-{yesterday}.json")
        
        # Update the result with only the hot cases for the main stats file
        result['data']['viewer']['zones'][0]['httpRequestsAdaptiveGroups'] = hot_cases
    
    return result

def save_to_file(data, filename):
    """Save data to JSON file"""
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Cloudflare Stats Query Tool')
    parser.add_argument('--email', help='Cloudflare account email')
    parser.add_argument('--key', help='Cloudflare API key')
    parser.add_argument('--zone', help='Cloudflare zone ID')
    parser.add_argument('--yesterday', help='Yesterday\'s date (YYYY-MM-DD)')
    parser.add_argument('--today', help='Today\'s date (YYYY-MM-DD)')
    args = parser.parse_args()
    
    # Override configuration with command-line arguments
    global AUTH_EMAIL, AUTH_KEY, ZONE_ID
    if args.email:
        AUTH_EMAIL = args.email
    if args.key:
        AUTH_KEY = args.key
    if args.zone:
        ZONE_ID = args.zone
    
    # Validate configuration
    if not all([AUTH_EMAIL, AUTH_KEY, ZONE_ID]):
        print("Error: Missing required configuration")
        print("Please set AUTH_EMAIL, AUTH_KEY, and ZONE_ID environment variables or provide them as command-line arguments.")
        return 1
    
    # Get dates
    yesterday, today = get_yesterday_and_today()
    if args.yesterday:
        yesterday = args.yesterday
    if args.today:
        today = args.today
    
    print(f"📅 统计日期范围: {yesterday} 至 {today}")
    print("\n🚀 查询 Cloudflare GraphQL API...")
    
    # Get basic stats
    print("\n📊 获取基本统计数据...")
    basic_stats = get_basic_stats(yesterday, today)
    if basic_stats and basic_stats.get('data'):
        save_to_file(basic_stats, f"cloudflare-stats-daily-{yesterday}.json")
        print("✅ 基本统计数据获取成功!")
    else:
        print("❌ 基本统计数据获取失败!")
        if basic_stats and basic_stats.get('errors'):
            print(f"错误信息: {basic_stats['errors']}")
    
    # Get hourly stats
    print("\n📊 获取每小时统计数据...")
    hourly_stats = get_hourly_stats(yesterday, today)
    if hourly_stats and hourly_stats.get('data'):
        save_to_file(hourly_stats, f"cloudflare-stats-hourly-{yesterday}.json")
        print("✅ 每小时统计数据获取成功!")
    else:
        print("❌ 每小时统计数据获取失败!")
        if hourly_stats and hourly_stats.get('errors'):
            print(f"错误信息: {hourly_stats['errors']}")
    
    # Try to get page stats
    print("\n📊 尝试获取页面路径统计数据...")
    page_stats = get_page_stats(yesterday, today)
    if page_stats and page_stats.get('data'):
        save_to_file(page_stats, f"cloudflare-stats-pages-{yesterday}.json")
        print("✅ 页面路径统计数据获取成功!")
    else:
        print("❌ 页面路径统计数据获取失败!")
        if page_stats and page_stats.get('errors'):
            print(f"错误信息: {page_stats['errors']}")
        print("提示: Cloudflare GraphQL API可能不支持requestPath维度，请检查您的账户权限或使用其他API端点。")
    
    # Print summary
    print("\n📊 统计摘要:")
    if basic_stats and basic_stats.get('data'):
        zones = basic_stats['data']['viewer']['zones']
        if zones:
            daily_groups = zones[0]['httpRequests1dGroups']
            if daily_groups:
                total = daily_groups[0]['sum']
                print(f"总页面浏览量: {total.get('pageViews', 0)}")
                print(f"总请求数: {total.get('requests', 0)}")
    
    # 查询特定页面的访问明细
    path_to_check = "/free/detail/supabase.html"
    print(f"\n🔍 正在深度查询页面明细: {path_to_check}")
    
    result = get_single_page_details(yesterday, today, path_to_check)
    
    if result:
        if 'data' in result:
            logs = result['data']['viewer']['zones'][0]['httpRequestsAdaptiveGroups']
            print(f"✅ 找到 {len(logs)} 条访问记录")
            
            # 打印前几条明细
            for log in logs[:5]:
                dimensions = log['dimensions']
                print(f"时间: {dimensions['datetime']} | IP: {dimensions['clientIP']}")
            
            # 保存特定页面的详细日志
            detailed_page_logs = []
            for log in logs:
                dimensions = log['dimensions']
                detailed_page_logs.append({
                    "datetime": dimensions['datetime'],
                    "clientIP": dimensions['clientIP'],
                    "userAgent": dimensions['userAgent'],
                    "path": path_to_check
                })
            save_to_file(detailed_page_logs, f"page-detail-{yesterday}-supabase.json")
        else:
            print(f"⚠️ API 返回数据结构不正确: {result}")
    else:
        print("❌ 获取页面明细失败")
    
    # 查询特定 IP 的访问路径
    ip_to_check = "115.194.149.254"
    print(f"\n🔍 正在查询 IP {ip_to_check} 的访问路径...")
    
    ip_activity = get_ip_activity(yesterday, today, ip_to_check)
    
    if ip_activity:
        print(f"✅ 找到 {len(ip_activity)} 条访问记录")
        
        # 打印前几条记录
        for activity in ip_activity[:5]:
            dimensions = activity['dimensions']
            print(f"时间: {dimensions['datetime']} | 路径: {dimensions['clientRequestPath']}")
        
        # 保存 IP 活动记录到文件
        ip_activity_data = []
        for activity in ip_activity:
            dimensions = activity['dimensions']
            ip_activity_data.append({
                "datetime": dimensions['datetime'],
                "clientRequestPath": dimensions['clientRequestPath'],
                "userAgent": dimensions['userAgent'],
                "clientIP": ip_to_check
            })
        
        ip_activity_file = f"ip-activity-{yesterday}-{ip_to_check.replace('.', '-')}.json"
        save_to_file(ip_activity_data, ip_activity_file)
        print(f"📄 IP 活动记录已保存到: {ip_activity_file}")
    else:
        print("❌ 未找到该 IP 的访问记录")
    
    print("\n📁 数据已保存到以下文件:")
    print(f"- 基本统计: cloudflare-stats-daily-{yesterday}.json")
    print(f"- 每小时统计: cloudflare-stats-hourly-{yesterday}.json")
    print(f"- 页面路径统计: cloudflare-stats-pages-{yesterday}.json")
    
    return 0

if __name__ == "__main__":
    exit(main())