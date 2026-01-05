def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

# 简单测试
if __name__ == "__main__":

    # 定一个数组
    arr = [64, 34, 25, 12, 22, 11, 90]

    arr[6] = 256

   

    # 调用一下冒泡排序 ，从小到大输出，tom弄的
    print(bubble_sort(arr))
